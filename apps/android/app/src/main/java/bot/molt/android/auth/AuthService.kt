package bot.molt.android.auth

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

class AuthService(
    private val baseUrl: String,
    private val client: OkHttpClient = OkHttpClient(),
) {
    private val json = Json { ignoreUnknownKeys = true }

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

    suspend fun signInWithEmail(email: String, password: String): Pair<String, AuthUser> {
        val body = json.encodeToString(SignInRequest.serializer(), SignInRequest(email, password))
        val request = Request.Builder()
            .url("$baseUrl/api/auth/sign-in/email")
            .post(body.toRequestBody(JSON_MEDIA))
            .build()

        val response = client.newCall(request).execute()
        if (!response.isSuccessful) throw AuthException("Invalid email or password.")

        val token = extractSessionToken(response) ?: run {
            val decoded = json.decodeFromString(SignInResponse.serializer(), response.body!!.string())
            decoded.token
        }
        val responseBody = response.peekBody(Long.MAX_VALUE).string()
        val decoded = json.decodeFromString(SignInResponse.serializer(), responseBody)

        if (token == null || decoded.user == null) throw AuthException("Sign in failed.")
        return Pair(token, decoded.user)
    }

    suspend fun signUpWithEmail(name: String, email: String, password: String): Pair<String, AuthUser> {
        val body = json.encodeToString(SignUpRequest.serializer(), SignUpRequest(name, email, password))
        val request = Request.Builder()
            .url("$baseUrl/api/auth/sign-up/email")
            .post(body.toRequestBody(JSON_MEDIA))
            .build()

        val response = client.newCall(request).execute()
        if (!response.isSuccessful) throw AuthException("Could not create account.")

        val token = extractSessionToken(response)
        val responseBody = response.peekBody(Long.MAX_VALUE).string()
        val decoded = json.decodeFromString(SignInResponse.serializer(), responseBody)

        val finalToken = token ?: decoded.token
        if (finalToken == null || decoded.user == null) throw AuthException("Sign up failed.")
        return Pair(finalToken, decoded.user)
    }

    suspend fun forgotPassword(email: String) {
        val body = """{"email":"$email"}"""
        val request = Request.Builder()
            .url("$baseUrl/api/auth/forget-password")
            .post(body.toRequestBody(JSON_MEDIA))
            .build()

        client.newCall(request).execute()
    }

    suspend fun getSession(token: String): Pair<String, AuthUser>? {
        val request = Request.Builder()
            .url("$baseUrl/api/auth/session")
            .header("Cookie", "better-auth.session_token=$token")
            .build()

        val response = try { client.newCall(request).execute() } catch (_: IOException) { return null }
        if (!response.isSuccessful) return null

        val newToken = extractSessionToken(response) ?: token
        val decoded = json.decodeFromString(SessionResponse.serializer(), response.body!!.string())
        val user = decoded.user ?: return null
        return Pair(newToken, user)
    }

    suspend fun signOut(token: String) {
        val request = Request.Builder()
            .url("$baseUrl/api/auth/sign-out")
            .header("Cookie", "better-auth.session_token=$token")
            .post("{}".toRequestBody(JSON_MEDIA))
            .build()

        try { client.newCall(request).execute() } catch (_: IOException) { /* ignore */ }
    }

    private fun extractSessionToken(response: okhttp3.Response): String? {
        val setCookie = response.header("Set-Cookie") ?: return null
        val regex = Regex("""better-auth\.session_token=([^;]+)""")
        return regex.find(setCookie)?.groupValues?.get(1)
    }

    companion object {
        private val JSON_MEDIA = "application/json".toMediaType()
    }
}

class AuthException(message: String) : Exception(message)
