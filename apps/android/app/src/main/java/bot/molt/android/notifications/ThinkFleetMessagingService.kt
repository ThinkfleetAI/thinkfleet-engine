package bot.molt.android.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class ThinkFleetMessagingService : FirebaseMessagingService() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM token refreshed")
        // Token will be re-registered on next app launch via PushNotificationManager
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "Push received: ${message.data}")

        val title = message.notification?.title ?: message.data["title"] ?: "ThinkFleet"
        val body = message.notification?.body ?: message.data["body"] ?: ""

        showNotification(title, body, message.data)
    }

    private fun showNotification(title: String, body: String, data: Map<String, String>) {
        val channelId = when {
            data.containsKey("agentId") -> CHANNEL_AGENT_EVENTS
            data.containsKey("taskId") -> CHANNEL_TASK_UPDATES
            else -> CHANNEL_GENERAL
        }

        // Create intent for tap action
        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            data.forEach { (key, value) -> putExtra(key, value) }
        }

        val pendingIntent = intent?.let {
            PendingIntent.getActivity(
                this, 0, it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // Replace with app icon
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .apply { pendingIntent?.let { setContentIntent(it) } }
            .build()

        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun createNotificationChannels() {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        listOf(
            NotificationChannel(CHANNEL_AGENT_EVENTS, "Agent Events", NotificationManager.IMPORTANCE_HIGH)
                .apply { description = "Notifications about agent status changes" },
            NotificationChannel(CHANNEL_TASK_UPDATES, "Task Updates", NotificationManager.IMPORTANCE_DEFAULT)
                .apply { description = "Notifications about task assignments and updates" },
            NotificationChannel(CHANNEL_GENERAL, "General", NotificationManager.IMPORTANCE_DEFAULT)
                .apply { description = "General notifications" },
        ).forEach { manager.createNotificationChannel(it) }
    }

    companion object {
        private const val TAG = "ThinkFleetFCM"
        const val CHANNEL_AGENT_EVENTS = "agent_events"
        const val CHANNEL_TASK_UPDATES = "task_updates"
        const val CHANNEL_GENERAL = "general"
    }
}
