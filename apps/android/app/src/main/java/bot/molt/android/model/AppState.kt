package bot.molt.android.model

import android.content.Context
import android.util.Log
import bot.molt.android.auth.AuthService
import bot.molt.android.auth.SessionStore
import bot.molt.android.networking.AgentActionInput
import bot.molt.android.networking.AgentListResponse
import bot.molt.android.networking.AgentResponse
import bot.molt.android.networking.Agent
import bot.molt.android.networking.Crew
import bot.molt.android.networking.CrewListResponse
import bot.molt.android.networking.ListAgentsInput
import bot.molt.android.networking.ListCrewsInput
import bot.molt.android.networking.Organization
import bot.molt.android.networking.OrganizationListResponse
import bot.molt.android.networking.SaaSApiClient
import bot.molt.android.networking.SocketIOManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

private const val TAG = "AppState"

class AppState(context: Context) {
    private val baseUrl = resolveBaseUrl()

    val sessionStore = SessionStore(context)
    val authService = AuthService(baseUrl)
    val apiClient = SaaSApiClient(baseUrl, sessionStore)
    val socketManager = SocketIOManager(baseUrl, sessionStore)
    val pushManager = bot.molt.android.notifications.PushNotificationManager(context)

    private val _organizations = MutableStateFlow<List<Organization>>(emptyList())
    val organizations: StateFlow<List<Organization>> = _organizations.asStateFlow()

    private val _currentOrganization = MutableStateFlow<Organization?>(null)
    val currentOrganization: StateFlow<Organization?> = _currentOrganization.asStateFlow()

    private val _agents = MutableStateFlow<List<Agent>>(emptyList())
    val agents: StateFlow<List<Agent>> = _agents.asStateFlow()

    private val _crews = MutableStateFlow<List<Crew>>(emptyList())
    val crews: StateFlow<List<Crew>> = _crews.asStateFlow()

    private val _isLoadingAgents = MutableStateFlow(false)
    val isLoadingAgents: StateFlow<Boolean> = _isLoadingAgents.asStateFlow()

    suspend fun onAuthenticated() {
        loadOrganizations()
        // socketManager.connect() is called by selectOrganization() during loadOrganizations()
        loadAgents()
        loadCrews()
        pushManager.registerToken(this)
    }

    suspend fun signOut() {
        pushManager.unregisterToken(this)
        sessionStore.sessionToken.value?.let { token ->
            try { authService.signOut(token) } catch (_: Exception) { }
        }
        socketManager.disconnect()
        sessionStore.clearSession()
        _organizations.value = emptyList()
        _currentOrganization.value = null
        _agents.value = emptyList()
        _crews.value = emptyList()
    }

    suspend fun restoreSessionIfNeeded() {
        val token = sessionStore.sessionToken.value ?: return
        if (sessionStore.isAuthenticated) return

        val result = try { authService.getSession(token) } catch (_: Exception) { null }
        if (result != null) {
            sessionStore.setSession(result.first, user = result.second)
            onAuthenticated()
        } else {
            sessionStore.clearSession()
        }
    }

    suspend fun loadOrganizations() {
        Log.i(TAG, "loadOrganizations: starting, token=${sessionStore.sessionToken.value?.take(8)}...")
        // Retry with back-off — the server may need a moment to persist a fresh session token
        for (attempt in 1..3) {
            try {
                val response = apiClient.rpcNoInput(
                    "organizations.list",
                    OrganizationListResponse.serializer()
                )
                Log.i(TAG, "loadOrganizations: loaded ${response.organizations.size} orgs")
                _organizations.value = response.organizations
                if (_currentOrganization.value == null) {
                    response.organizations.firstOrNull()?.let {
                        Log.i(TAG, "loadOrganizations: selecting org ${it.name} (${it.id})")
                        selectOrganization(it)
                    }
                }
                return
            } catch (e: Exception) {
                Log.e(TAG, "loadOrganizations: attempt $attempt failed: ${e.message}", e)
                if (attempt < 3) kotlinx.coroutines.delay(500L * attempt)
            }
        }
        Log.e(TAG, "loadOrganizations: all 3 attempts failed")
    }

    fun selectOrganization(org: Organization) {
        _currentOrganization.value = org
        sessionStore.setOrganization(org.id)
        // Reconnect Socket.IO with new org context
        socketManager.connect()
    }

    suspend fun loadAgents() {
        val orgId = _currentOrganization.value?.id ?: run {
            Log.w(TAG, "loadAgents: no currentOrganization")
            return
        }
        _isLoadingAgents.value = true
        try {
            val response = apiClient.rpc(
                "assistants.agents.list",
                ListAgentsInput(orgId),
                ListAgentsInput.serializer(),
                AgentListResponse.serializer()
            )
            Log.i(TAG, "loadAgents: loaded ${response.agents.size} agents")
            _agents.value = response.agents
        } catch (e: Exception) {
            Log.e(TAG, "loadAgents: failed: ${e.message}", e)
        }
        _isLoadingAgents.value = false
    }

    suspend fun loadCrews() {
        val orgId = _currentOrganization.value?.id ?: run {
            Log.w(TAG, "loadCrews: no currentOrganization")
            return
        }
        try {
            val response = apiClient.rpc(
                "assistants.crews.list",
                ListCrewsInput(orgId),
                ListCrewsInput.serializer(),
                CrewListResponse.serializer()
            )
            Log.i(TAG, "loadCrews: loaded ${response.crews.size} crews")
            _crews.value = response.crews
        } catch (e: Exception) {
            Log.e(TAG, "loadCrews: failed: ${e.message}", e)
        }
    }

    suspend fun startAgent(agentId: String) {
        val orgId = _currentOrganization.value?.id ?: return
        apiClient.rpc(
            "assistants.agents.start",
            AgentActionInput(agentId, orgId),
            AgentActionInput.serializer(),
            AgentResponse.serializer()
        )
        loadAgents()
    }

    suspend fun stopAgent(agentId: String) {
        val orgId = _currentOrganization.value?.id ?: return
        apiClient.rpc(
            "assistants.agents.stop",
            AgentActionInput(agentId, orgId),
            AgentActionInput.serializer(),
            AgentResponse.serializer()
        )
        loadAgents()
    }

    private fun resolveBaseUrl(): String {
        return bot.molt.android.config.ThinkFleetConfig.apiBaseUrl
    }
}
