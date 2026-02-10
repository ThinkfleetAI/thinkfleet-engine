package bot.molt.android.networking

import android.util.Log
import bot.molt.android.auth.SessionStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.KSerializer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

private const val TAG = "SaaSApi"

class SaaSApiClient(
    private val baseUrl: String,
    private val sessionStore: SessionStore,
    private val client: OkHttpClient = OkHttpClient(),
) {
    private val json = Json { ignoreUnknownKeys = true }

    private fun rpcUrl(path: String): String {
        val slashPath = path.replace('.', '/')
        return "$baseUrl/api/rpc/$slashPath"
    }

    // oRPC RPC protocol wraps requests as {"json": <input>} and responses as {"json": <output>}

    suspend fun <I, O> rpc(
        path: String,
        input: I,
        inputSerializer: KSerializer<I>,
        outputSerializer: KSerializer<O>,
    ): O = withContext(Dispatchers.IO) {
        val inputBody = json.encodeToString(inputSerializer, input)
        val body = """{"json":$inputBody}"""
        val url = rpcUrl(path)
        Log.i(TAG, "rpc: POST $path token=${sessionStore.sessionToken.value?.take(8)}... org=${sessionStore.organizationId.value}")
        val request = buildRequest(url, body)

        val response = client.newCall(request).execute()
        val responseBody = response.body?.string() ?: ""
        Log.i(TAG, "rpc: $path → ${response.code}: ${responseBody.take(200)}")

        if (response.code == 401) {
            Log.w(TAG, "rpc: $path got 401, attempting session refresh")
            val refreshed = refreshSession()
            if (refreshed) {
                val retryRequest = buildRequest(url, body)
                val retryResponse = client.newCall(retryRequest).execute()
                val retryBody = retryResponse.body?.string() ?: ""
                Log.i(TAG, "rpc: $path retry → ${retryResponse.code}: ${retryBody.take(200)}")
                if (!retryResponse.isSuccessful) throw ApiException(retryResponse.code, "Request failed")
                return@withContext decodeRpcResponse(retryBody, outputSerializer)
            }
            throw ApiException(401, "Unauthorized")
        }

        if (!response.isSuccessful) throw ApiException(response.code, "Request failed")
        decodeRpcResponse(responseBody, outputSerializer)
    }

    suspend fun <O> rpcNoInput(
        path: String,
        outputSerializer: KSerializer<O>,
    ): O = withContext(Dispatchers.IO) {
        val url = rpcUrl(path)
        Log.i(TAG, "rpcNoInput: POST $path token=${sessionStore.sessionToken.value?.take(8)}... org=${sessionStore.organizationId.value}")
        val request = buildRequest(url, """{"json":{}}""")

        val response = client.newCall(request).execute()
        val responseBody = response.body?.string() ?: ""
        Log.i(TAG, "rpcNoInput: $path → ${response.code}: ${responseBody.take(200)}")

        if (response.code == 401) {
            Log.w(TAG, "rpcNoInput: $path got 401, attempting session refresh")
            val refreshed = refreshSession()
            if (refreshed) {
                val retryRequest = buildRequest(url, """{"json":{}}""")
                val retryResponse = client.newCall(retryRequest).execute()
                val retryBody = retryResponse.body?.string() ?: ""
                Log.i(TAG, "rpcNoInput: $path retry → ${retryResponse.code}: ${retryBody.take(200)}")
                if (!retryResponse.isSuccessful) throw ApiException(retryResponse.code, "Request failed")
                return@withContext decodeRpcResponse(retryBody, outputSerializer)
            }
            throw ApiException(401, "Unauthorized")
        }

        if (!response.isSuccessful) throw ApiException(response.code, "Request failed")
        decodeRpcResponse(responseBody, outputSerializer)
    }

    /** Unwrap oRPC response envelope: {"json": <data>} → <data> */
    private fun <O> decodeRpcResponse(responseStr: String, outputSerializer: KSerializer<O>): O {
        val envelope = json.parseToJsonElement(responseStr).jsonObject
        val jsonContent = envelope["json"] ?: throw ApiException(0, "Invalid oRPC response: missing json field")
        return json.decodeFromJsonElement(outputSerializer, jsonContent)
    }

    private fun buildRequest(url: String, body: String): Request {
        val builder = Request.Builder()
            .url(url)
            .post(body.toRequestBody(JSON_MEDIA))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            // Origin header required by Better Auth for CSRF validation on POST requests
            .header("Origin", baseUrl.trimEnd('/'))

        sessionStore.sessionToken.value?.let { token ->
            builder.header("Cookie", "$SESSION_COOKIE_NAME=$token")
        }
        sessionStore.organizationId.value?.let { orgId ->
            builder.header("x-organization-id", orgId)
        }

        return builder.build()
    }

    private suspend fun refreshSession(): Boolean = withContext(Dispatchers.IO) {
        val token = sessionStore.sessionToken.value ?: return@withContext false
        Log.i(TAG, "refreshSession: attempting with token=${token.take(8)}...")
        val request = Request.Builder()
            .url("$baseUrl/api/auth/get-session")
            .header("Cookie", "$SESSION_COOKIE_NAME=$token")
            .header("Origin", baseUrl.trimEnd('/'))
            .build()

        val response = try { client.newCall(request).execute() } catch (e: Exception) {
            Log.e(TAG, "refreshSession: network error: ${e.message}")
            return@withContext false
        }
        Log.i(TAG, "refreshSession: status=${response.code}")
        if (!response.isSuccessful) return@withContext false

        // If server sends a refreshed signed token in Set-Cookie, update the stored token
        val newSignedToken = extractSessionToken(response)
        if (newSignedToken != null) {
            Log.i(TAG, "refreshSession: got refreshed signed token=${newSignedToken.take(8)}...")
            sessionStore.currentUser.value?.let { user ->
                sessionStore.setSession(newSignedToken, user = user)
            }
        }
        true
    }

    /** Extract the signed session token from the Set-Cookie header. */
    private fun extractSessionToken(response: okhttp3.Response): String? {
        val setCookies = response.headers("Set-Cookie")
        for (cookie in setCookies) {
            val regex = Regex("""better-auth\.session_token=([^;,]+)""")
            val match = regex.find(cookie)
            if (match != null) return match.groupValues[1]
        }
        return null
    }

    companion object {
        /** Cookie name used by Better Auth in production (https:// base URL enables __Secure- prefix). */
        private const val SESSION_COOKIE_NAME = "__Secure-better-auth.session_token"
        private val JSON_MEDIA = "application/json".toMediaType()
    }
}

class ApiException(val statusCode: Int, message: String) : Exception(message)
