package bot.molt.android.networking

import bot.molt.android.auth.SessionStore
import kotlinx.serialization.json.Json
import kotlinx.serialization.KSerializer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class SaaSApiClient(
    private val baseUrl: String,
    private val sessionStore: SessionStore,
    private val client: OkHttpClient = OkHttpClient(),
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun <I, O> rpc(
        path: String,
        input: I,
        inputSerializer: KSerializer<I>,
        outputSerializer: KSerializer<O>,
    ): O {
        val body = json.encodeToString(inputSerializer, input)
        val request = buildRequest("$baseUrl/api/rpc/$path", body)

        val response = client.newCall(request).execute()

        if (response.code == 401) {
            val refreshed = refreshSession()
            if (refreshed) {
                val retryRequest = buildRequest("$baseUrl/api/rpc/$path", body)
                val retryResponse = client.newCall(retryRequest).execute()
                if (!retryResponse.isSuccessful) throw ApiException(retryResponse.code, "Request failed")
                return json.decodeFromString(outputSerializer, retryResponse.body!!.string())
            }
            sessionStore.clearSession()
            throw ApiException(401, "Unauthorized")
        }

        if (!response.isSuccessful) throw ApiException(response.code, "Request failed")
        return json.decodeFromString(outputSerializer, response.body!!.string())
    }

    suspend fun <O> rpcNoInput(
        path: String,
        outputSerializer: KSerializer<O>,
    ): O {
        val request = buildRequest("$baseUrl/api/rpc/$path", "{}")
        val response = client.newCall(request).execute()
        if (!response.isSuccessful) throw ApiException(response.code, "Request failed")
        return json.decodeFromString(outputSerializer, response.body!!.string())
    }

    private fun buildRequest(url: String, body: String): Request {
        val builder = Request.Builder()
            .url(url)
            .post(body.toRequestBody(JSON_MEDIA))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")

        sessionStore.sessionToken.value?.let { token ->
            builder.header("Cookie", "better-auth.session_token=$token")
        }
        sessionStore.organizationId.value?.let { orgId ->
            builder.header("x-organization-id", orgId)
        }

        return builder.build()
    }

    private suspend fun refreshSession(): Boolean {
        val token = sessionStore.sessionToken.value ?: return false
        val request = Request.Builder()
            .url("$baseUrl/api/auth/session")
            .header("Cookie", "better-auth.session_token=$token")
            .build()

        val response = try { client.newCall(request).execute() } catch (_: Exception) { return false }
        if (!response.isSuccessful) return false

        val setCookie = response.header("Set-Cookie") ?: return true
        val regex = Regex("""better-auth\.session_token=([^;]+)""")
        val match = regex.find(setCookie) ?: return true
        val newToken = match.groupValues[1]
        sessionStore.currentUser.value?.let { user ->
            sessionStore.setSession(newToken, user)
        }
        return true
    }

    companion object {
        private val JSON_MEDIA = "application/json".toMediaType()
    }
}

class ApiException(val statusCode: Int, message: String) : Exception(message)
