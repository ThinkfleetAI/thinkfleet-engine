package bot.molt.android.notifications

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import bot.molt.android.model.AppState
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.Serializable

class PushNotificationManager(private val context: Context) {
    private val _isRegistered = MutableStateFlow(false)
    val isRegistered: StateFlow<Boolean> = _isRegistered.asStateFlow()

    private var currentToken: String? = null

    /**
     * Check if POST_NOTIFICATIONS permission is needed and granted.
     * On Android 13+, this permission must be requested at runtime.
     */
    fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true // Permission not needed before Android 13
        }
    }

    /**
     * Register FCM token with the SaaS backend.
     * Call this after auth and after notification permission is granted.
     */
    suspend fun registerToken(appState: AppState) {
        try {
            val token = FirebaseMessaging.getInstance().token.await()
            currentToken = token

            val orgId = appState.currentOrganization.value?.id
            val appVersion = try {
                context.packageManager.getPackageInfo(context.packageName, 0).versionName
            } catch (_: Exception) { null }

            val deviceId = android.provider.Settings.Secure.getString(
                context.contentResolver, android.provider.Settings.Secure.ANDROID_ID
            )

            val response = appState.apiClient.rpc(
                "assistants.push.register",
                RegisterTokenInput("ANDROID", token, deviceId, appVersion, orgId),
                RegisterTokenInput.serializer(),
                RegisterTokenResponse.serializer()
            )

            _isRegistered.value = response.registered == true
            Log.i(TAG, "Push token registered: ${response.registered}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register push token", e)
            _isRegistered.value = false
        }
    }

    /**
     * Unregister the current FCM token from the backend.
     * Call this on sign out.
     */
    suspend fun unregisterToken(appState: AppState) {
        val token = currentToken ?: return
        try {
            appState.apiClient.rpc(
                "assistants.push.unregister",
                UnregisterTokenInput(token),
                UnregisterTokenInput.serializer(),
                UnregisterTokenResponse.serializer()
            )
            _isRegistered.value = false
        } catch (e: Exception) {
            Log.e(TAG, "Failed to unregister push token", e)
        }
    }

    companion object {
        private const val TAG = "PushNotificationMgr"
    }
}

@Serializable
private data class RegisterTokenInput(
    val platform: String,
    val token: String,
    val deviceId: String?,
    val appVersion: String?,
    val organizationId: String?,
)

@Serializable
private data class RegisterTokenResponse(
    val id: String? = null,
    val registered: Boolean? = null,
)

@Serializable
private data class UnregisterTokenInput(val token: String)

@Serializable
private data class UnregisterTokenResponse(val success: Boolean? = null)
