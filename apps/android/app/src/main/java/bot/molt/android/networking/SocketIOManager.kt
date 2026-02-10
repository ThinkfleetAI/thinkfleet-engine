package bot.molt.android.networking

import android.util.Log
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

private const val TAG = "SocketIO"

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
        val token = sessionStore.rawToken.value ?: sessionStore.sessionToken.value
        if (token == null) {
            Log.w(TAG, "connect: no session token, skipping")
            return
        }

        // Disconnect existing connection first
        if (socket != null) {
            Log.i(TAG, "connect: disconnecting existing socket before reconnect")
            socket?.disconnect()
            socket = null
        }

        val orgId = sessionStore.organizationId.value
        if (orgId != null) {
            Log.i(TAG, "connect: connecting with orgId=$orgId")
        } else {
            Log.w(TAG, "connect: no organizationId set — server may reject agent operations")
        }

        val opts = IO.Options.builder()
            .setPath("/api/socket.io")
            .setTransports(arrayOf("websocket"))
            .setReconnection(true)
            .setReconnectionDelay(1000)
            .setReconnectionDelayMax(10000)
            .setQuery("token=$token${orgId?.let { "&organizationId=$it" } ?: ""}")
            .build()

        socket = IO.socket(baseUrl, opts).apply {
            on(Socket.EVENT_CONNECT) {
                Log.i(TAG, "Socket.IO connected")
                _isConnected.value = true
            }
            on(Socket.EVENT_DISCONNECT) {
                Log.i(TAG, "Socket.IO disconnected")
                _isConnected.value = false
            }
            on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e(TAG, "Socket.IO connect error: ${args.firstOrNull()}")
            }

            on("agent:event") { args ->
                val data = args.firstOrNull() as? JSONObject ?: return@on
                val agentId = data.optString("agentId", "")
                val eventType = data.optString("event", "unknown")
                if (agentId.isNotEmpty()) {
                    Log.d(TAG, "agent:event received: agent=$agentId event=$eventType")
                    val handler = agentEventHandlers[agentId]
                    if (handler != null) {
                        handler.invoke(agentId, data)
                    } else {
                        Log.w(TAG, "agent:event: no handler for agent $agentId")
                    }
                }
            }

            on("rpc:response") { args ->
                val data = args.firstOrNull() as? JSONObject ?: return@on
                val id = data.optString("id", "")
                if (id.isNotEmpty()) {
                    val callback = rpcCallbacks.remove(id) ?: return@on
                    if (data.has("error")) {
                        val msg = data.optJSONObject("error")?.optString("message") ?: "RPC error"
                        Log.e(TAG, "rpc:response error id=$id: $msg")
                        callback(Result.failure(Exception(msg)))
                    } else {
                        Log.i(TAG, "rpc:response success id=$id")
                        callback(Result.success(data))
                    }
                }
            }

            Log.i(TAG, "connect: calling socket.connect() to $baseUrl")
            connect()
        }
    }

    fun disconnect() {
        Log.i(TAG, "disconnect: tearing down socket")
        socket?.disconnect()
        socket = null
        agentEventHandlers.clear()
        rpcCallbacks.clear()
        _isConnected.value = false
    }

    fun subscribeToAgent(agentId: String, handler: (String, JSONObject) -> Unit) {
        agentEventHandlers[agentId] = handler
        if (_isConnected.value) {
            Log.i(TAG, "subscribe: emitting subscribe for agent $agentId")
            socket?.emit("subscribe", JSONObject().put("agentId", agentId))
        } else {
            Log.w(TAG, "subscribe: socket not connected, queueing subscribe for agent $agentId")
            socket?.on(Socket.EVENT_CONNECT) {
                if (agentEventHandlers.containsKey(agentId)) {
                    Log.i(TAG, "subscribe: deferred subscribe for agent $agentId after connect")
                    socket?.emit("subscribe", JSONObject().put("agentId", agentId))
                }
            }
        }
    }

    fun unsubscribeFromAgent(agentId: String) {
        agentEventHandlers.remove(agentId)
        socket?.emit("unsubscribe", JSONObject().put("agentId", agentId))
        Log.i(TAG, "unsubscribe: agent $agentId")
    }

    /**
     * Subscribe to an agent's chat events with typed payload parsing.
     * Parses agent:event data with event=="chat" and extracts state/role/text.
     */
    fun subscribeToChatEvents(agentId: String, handler: (ChatEventData) -> Unit) {
        subscribeToAgent(agentId) { _, data ->
            val eventType = data.optString("event", "")
            if (eventType == "chat") {
                val payload = data.optJSONObject("payload") ?: return@subscribeToAgent
                val state = payload.optString("state", "delta")
                val sessionKey: String? = if (payload.has("sessionKey")) payload.getString("sessionKey") else null

                // Extract text from message.content[].text or message.content (string)
                val message = payload.optJSONObject("message")
                val role = message?.optString("role") ?: payload.optString("role", "assistant")
                val text: String? = if (message != null) {
                    val contentArray = message.optJSONArray("content")
                    if (contentArray != null) {
                        buildString {
                            for (i in 0 until contentArray.length()) {
                                val item = contentArray.optJSONObject(i)
                                if (item != null) append(item.optString("text", ""))
                            }
                        }.ifEmpty { null }
                    } else {
                        if (message.has("content")) message.getString("content") else null
                    }
                } else {
                    if (payload.has("content")) payload.getString("content") else null
                }

                Log.d(TAG, "chatEvent: state=$state text=${text?.take(50)}")
                handler(ChatEventData(state, role, text, sessionKey))
            }
        }
    }

    data class ChatEventData(
        val state: String,
        val role: String?,
        val text: String?,
        val sessionKey: String?,
    )

    suspend fun sendRPC(agentId: String, method: String, params: Map<String, Any> = emptyMap()): JSONObject {
        // Wait up to 5 seconds for socket connection to establish
        if (!_isConnected.value) {
            Log.i(TAG, "sendRPC: waiting for socket connection before sending $method...")
            repeat(50) {
                kotlinx.coroutines.delay(100)
                if (_isConnected.value) return@repeat
            }
        }
        if (!_isConnected.value) {
            Log.e(TAG, "sendRPC: socket not connected after waiting, cannot send $method to $agentId")
            throw Exception("Socket not connected")
        }

        val id = UUID.randomUUID().toString()
        val request = JSONObject().apply {
            put("id", id)
            put("agentId", agentId)
            put("method", method)
            put("params", JSONObject(params))
        }

        Log.i(TAG, "sendRPC: id=$id agent=$agentId method=$method")

        return suspendCoroutine { continuation ->
            rpcCallbacks[id] = { result ->
                result.onSuccess { continuation.resume(it) }
                result.onFailure { continuation.resumeWithException(it) }
            }
            socket?.emit("rpc", request)
        }
    }
}
