package bot.molt.android.config

object ThinkFleetConfig {
    /** Base URL for the SaaS API. Override via BuildConfig or system env. */
    val apiBaseUrl: String by lazy {
        System.getenv("THINKFLEET_API_URL")
            ?: try {
                val field = Class.forName("com.thinkfleet.android.BuildConfig").getField("THINKFLEET_API_URL")
                field.get(null) as? String ?: DEFAULT_URL
            } catch (_: Exception) {
                DEFAULT_URL
            }
    }

    private const val DEFAULT_URL = "https://www.thinkfleet.ai"

    const val SOCKET_IO_PATH = "/api/socket.io"
    const val RPC_BASE_PATH = "/api/rpc"
    const val AUTH_BASE_PATH = "/api/auth"

    const val PREFS_NAME = "thinkfleet_session"
}
