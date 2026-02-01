package bot.molt.android.networking

import bot.molt.android.auth.SessionStore
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

class SocketIOManager(
    private val baseUrl: String,
    private val sessionStore: SessionStore,
) {
    private var socket: Socket? = null

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val agentEventHandlers = ConcurrentHashMap<String, (String, JSONObject) -> Unit>()
    private val rpcCallbacks = ConcurrentHashMap<String, (Result<JSONObject>) -> Unit>()

    fun connect() {
        val token = sessionStore.sessionToken.value ?: return
        val orgId = sessionStore.organizationId.value

        val opts = IO.Options.builder()
            .setPath("/api/socket.io")
            .setTransports(arrayOf("websocket"))
            .setReconnection(true)
            .setReconnectionDelay(1000)
            .setReconnectionDelayMax(10000)
            .setQuery("token=$token${orgId?.let { "&organizationId=$it" } ?: ""}")
            .build()

        socket = IO.socket(baseUrl, opts).apply {
            on(Socket.EVENT_CONNECT) { _isConnected.value = true }
            on(Socket.EVENT_DISCONNECT) { _isConnected.value = false }

            on("agent:event") { args ->
                val data = args.firstOrNull() as? JSONObject ?: return@on
                val agentId = data.optString("agentId", "")
                if (agentId.isNotEmpty()) {
                    agentEventHandlers[agentId]?.invoke(agentId, data)
                }
            }

            on("rpc:response") { args ->
                val data = args.firstOrNull() as? JSONObject ?: return@on
                val id = data.optString("id", "")
                if (id.isNotEmpty()) {
                    val callback = rpcCallbacks.remove(id) ?: return@on
                    if (data.has("error")) {
                        val msg = data.optJSONObject("error")?.optString("message") ?: "RPC error"
                        callback(Result.failure(Exception(msg)))
                    } else {
                        callback(Result.success(data))
                    }
                }
            }

            connect()
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket = null
        agentEventHandlers.clear()
        rpcCallbacks.clear()
    }

    fun subscribeToAgent(agentId: String, handler: (String, JSONObject) -> Unit) {
        agentEventHandlers[agentId] = handler
        socket?.emit("subscribe", JSONObject().put("agentId", agentId))
    }

    fun unsubscribeFromAgent(agentId: String) {
        agentEventHandlers.remove(agentId)
        socket?.emit("unsubscribe", JSONObject().put("agentId", agentId))
    }

    suspend fun sendRPC(agentId: String, method: String, params: Map<String, Any> = emptyMap()): JSONObject {
        val id = UUID.randomUUID().toString()
        val request = JSONObject().apply {
            put("id", id)
            put("agentId", agentId)
            put("method", method)
            put("params", JSONObject(params))
        }

        return suspendCoroutine { continuation ->
            rpcCallbacks[id] = { result ->
                result.onSuccess { continuation.resume(it) }
                result.onFailure { continuation.resumeWithException(it) }
            }
            socket?.emit("rpc", request)
        }
    }
}
