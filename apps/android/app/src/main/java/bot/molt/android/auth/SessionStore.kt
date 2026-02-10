@file:Suppress("DEPRECATION")

package bot.molt.android.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class SessionStore(context: Context) {
    private val prefs: SharedPreferences

    /** The signed session token (from Set-Cookie) — used for oRPC API calls. */
    private val _sessionToken = MutableStateFlow<String?>(null)
    val sessionToken: StateFlow<String?> = _sessionToken.asStateFlow()

    /** The raw session token (from response body) — used for Socket.IO direct DB lookup. */
    private val _rawToken = MutableStateFlow<String?>(null)
    val rawToken: StateFlow<String?> = _rawToken.asStateFlow()

    private val _currentUser = MutableStateFlow<AuthUser?>(null)
    val currentUser: StateFlow<AuthUser?> = _currentUser.asStateFlow()

    private val _organizationId = MutableStateFlow<String?>(null)
    val organizationId: StateFlow<String?> = _organizationId.asStateFlow()

    val isAuthenticated: Boolean
        get() = _sessionToken.value != null && _currentUser.value != null

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        prefs = EncryptedSharedPreferences.create(
            context,
            "thinkfleet_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        _sessionToken.value = prefs.getString(KEY_TOKEN, null)
        _rawToken.value = prefs.getString(KEY_RAW_TOKEN, null)
        _organizationId.value = prefs.getString(KEY_ORG_ID, null)
    }

    fun setSession(token: String, rawToken: String? = null, user: AuthUser) {
        val editor = prefs.edit().putString(KEY_TOKEN, token)
        if (rawToken != null) editor.putString(KEY_RAW_TOKEN, rawToken)
        editor.apply()
        _sessionToken.value = token
        if (rawToken != null) _rawToken.value = rawToken
        _currentUser.value = user
    }

    fun setOrganization(id: String) {
        prefs.edit().putString(KEY_ORG_ID, id).apply()
        _organizationId.value = id
    }

    fun clearSession() {
        prefs.edit().clear().apply()
        _sessionToken.value = null
        _rawToken.value = null
        _currentUser.value = null
        _organizationId.value = null
    }

    companion object {
        private const val KEY_TOKEN = "session_token"
        private const val KEY_RAW_TOKEN = "raw_session_token"
        private const val KEY_ORG_ID = "organization_id"
    }
}

@kotlinx.serialization.Serializable
data class AuthUser(
    val id: String,
    val name: String? = null,
    val email: String,
    val image: String? = null,
    val emailVerified: Boolean = false,
)
