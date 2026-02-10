package bot.molt.android.auth

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

private const val TAG = "AuthService"

/** Cookie name used by Better Auth in production (https:// base URL enables __Secure- prefix). */
private const val SESSION_COOKIE_NAME = "__Secure-better-auth.session_token"

/** Result containing both the signed token (for oRPC cookies) and raw token (for Socket.IO DB lookup). */
data class AuthTokens(val signedToken: String, val rawToken: String, val user: AuthUser)

class AuthService(
    private val baseUrl: String,
    private val client: OkHttpClient = OkHttpClient(),
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val origin: String get() = baseUrl.trimEnd('/')

    @Serializable
    data class SignInRequest(val email: String, val password: String)

    @Serializable
    data class SignUpRequest(val name: String, val email: String, val password: String)

    @Serializable
    data class SignInResponse(val token: String? = null, val user: AuthUser? = null)

    @Serializable
    data class SessionResponse(val session: SessionInfo? = null, val user: AuthUser? = null)

    @Serializable
    data class SessionInfo(val id: String, val token: String, val expiresAt: String)

    suspend fun signInWithEmail(email: String, password: String): AuthTokens = withContext(Dispatchers.IO) {
        val body = json.encodeToString(SignInRequest.serializer(), SignInRequest(email, password))
        val request = Request.Builder()
            .url("$baseUrl/api/auth/sign-in/email")
            .header("Content-Type", "application/json")
            .header("Origin", origin)
            .post(body.toRequestBody(JSON_MEDIA))
            .build()

        val response = client.newCall(request).execute()
        if (!response.isSuccessful) throw AuthException("Invalid email or password.")

        // Signed token from Set-Cookie — needed for oRPC API calls (Better Auth HMAC-SHA-256 signed cookies)
        val signedToken = extractSessionToken(response)
        // Raw token from response body — needed for Socket.IO (direct DB lookup)
        val responseBody = response.peekBody(Long.MAX_VALUE).string()
        val decoded = json.decodeFromString(SignInResponse.serializer(), responseBody)
        val rawToken = decoded.token

        Log.i(TAG, "signIn: signed=${signedToken?.take(20)}... raw=${rawToken?.take(12)}...")

        if (signedToken == null || rawToken == null || decoded.user == null) throw AuthException("Sign in failed.")
        AuthTokens(signedToken, rawToken, decoded.user)
    }

    suspend fun signUpWithEmail(name: String, email: String, password: String): AuthTokens = withContext(Dispatchers.IO) {
        val body = json.encodeToString(SignUpRequest.serializer(), SignUpRequest(name, email, password))
        val request = Request.Builder()
            .url("$baseUrl/api/auth/sign-up/email")
            .header("Content-Type", "application/json")
            .header("Origin", origin)
            .post(body.toRequestBody(JSON_MEDIA))
            .build()

        val response = client.newCall(request).execute()
        if (!response.isSuccessful) throw AuthException("Could not create account.")

        val signedToken = extractSessionToken(response)
        val responseBody = response.peekBody(Long.MAX_VALUE).string()
        val decoded = json.decodeFromString(SignInResponse.serializer(), responseBody)
        val rawToken = decoded.token

        if (signedToken == null || rawToken == null || decoded.user == null) throw AuthException("Sign up failed.")
        AuthTokens(signedToken, rawToken, decoded.user)
    }

    suspend fun forgotPassword(email: String): Unit = withContext(Dispatchers.IO) {
        val body = """{"email":"$email"}"""
        val request = Request.Builder()
            .url("$baseUrl/api/auth/forget-password")
            .header("Origin", origin)
            .post(body.toRequestBody(JSON_MEDIA))
            .build()

        client.newCall(request).execute()
    }

    /** Restore session using the signed token. Returns the (possibly refreshed) signed token + user. */
    suspend fun getSession(token: String): Pair<String, AuthUser>? = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl/api/auth/get-session")
            .header("Cookie", "$SESSION_COOKIE_NAME=$token")
            .header("Origin", origin)
            .build()

        val response = try { client.newCall(request).execute() } catch (_: IOException) { return@withContext null }
        if (!response.isSuccessful) return@withContext null

        val decoded = json.decodeFromString(SessionResponse.serializer(), response.body!!.string())
        // If server sends a new signed token in Set-Cookie, use it; otherwise keep existing
        val newToken = extractSessionToken(response) ?: token
        val user = decoded.user ?: return@withContext null
        Pair(newToken, user)
    }

    suspend fun signOut(token: String): Unit = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl/api/auth/sign-out")
            .header("Cookie", "$SESSION_COOKIE_NAME=$token")
            .header("Origin", origin)
            .post("{}".toRequestBody(JSON_MEDIA))
            .build()

        try { client.newCall(request).execute() } catch (_: IOException) { /* ignore */ }
    }

    /**
     * Extract the signed session token from the Set-Cookie header.
     * Matches on `better-auth.session_token=` to handle both __Secure- prefixed and unprefixed names.
     */
    private fun extractSessionToken(response: okhttp3.Response): String? {
        // OkHttp returns multiple Set-Cookie headers via headers("Set-Cookie")
        val setCookies = response.headers("Set-Cookie")
        for (cookie in setCookies) {
            val regex = Regex("""better-auth\.session_token=([^;,]+)""")
            val match = regex.find(cookie)
            if (match != null) return match.groupValues[1]
        }
        return null
    }

    companion object {
        private val JSON_MEDIA = "application/json".toMediaType()
    }
}

class AuthException(message: String) : Exception(message)
