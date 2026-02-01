package bot.molt.android.model

import android.content.Context
import bot.molt.android.auth.AuthService
import bot.molt.android.auth.SessionStore
import bot.molt.android.networking.AgentActionInput
import bot.molt.android.networking.AgentListResponse
import bot.molt.android.networking.AgentResponse
import bot.molt.android.networking.Agent
import bot.molt.android.networking.ListAgentsInput
import bot.molt.android.networking.Organization
import bot.molt.android.networking.OrganizationListResponse
import bot.molt.android.networking.SaaSApiClient
import bot.molt.android.networking.SocketIOManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

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

    private val _isLoadingAgents = MutableStateFlow(false)
    val isLoadingAgents: StateFlow<Boolean> = _isLoadingAgents.asStateFlow()

    suspend fun onAuthenticated() {
        socketManager.connect()
        loadOrganizations()
        loadAgents()
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
    }

    suspend fun restoreSessionIfNeeded() {
        val token = sessionStore.sessionToken.value ?: return
        if (sessionStore.isAuthenticated) return

        val result = try { authService.getSession(token) } catch (_: Exception) { null }
        if (result != null) {
            sessionStore.setSession(result.first, result.second)
            onAuthenticated()
        } else {
            sessionStore.clearSession()
        }
    }

    suspend fun loadOrganizations() {
        try {
            val response = apiClient.rpcNoInput(
                "organizations.list",
                OrganizationListResponse.serializer()
            )
            _organizations.value = response.organizations
            if (_currentOrganization.value == null) {
                response.organizations.firstOrNull()?.let { selectOrganization(it) }
            }
        } catch (_: Exception) { }
    }

    fun selectOrganization(org: Organization) {
        _currentOrganization.value = org
        sessionStore.setOrganization(org.id)
    }

    suspend fun loadAgents() {
        val orgId = _currentOrganization.value?.id ?: return
        _isLoadingAgents.value = true
        try {
            val response = apiClient.rpc(
                "assistants.agents.list",
                ListAgentsInput(orgId),
                ListAgentsInput.serializer(),
                AgentListResponse.serializer()
            )
            _agents.value = response.agents
        } catch (_: Exception) { }
        _isLoadingAgents.value = false
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
