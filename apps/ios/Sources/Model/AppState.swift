import Foundation
import Observation

@Observable
final class AppState: @unchecked Sendable {
    let sessionStore: SessionStore
    let authService: AuthService
    let apiClient: SaaSAPIClient
    let socketManager: SocketIOManager

    private(set) var organizations: [Organization] = []
    private(set) var currentOrganization: Organization?
    private(set) var agents: [Agent] = []
    private(set) var crews: [Crew] = []
    private(set) var isLoadingAgents = false
    private(set) var isLoadingCrews = false
    var pushManager: PushNotificationManager?

    init() {
        let baseURL = Self.resolveBaseURL()
        self.sessionStore = SessionStore()
        self.authService = AuthService(baseURL: baseURL)
        self.apiClient = SaaSAPIClient(baseURL: baseURL, sessionStore: sessionStore)
        self.socketManager = SocketIOManager(baseURL: baseURL, sessionStore: sessionStore)
    }

    // MARK: - Lifecycle

    func onAuthenticated() async {
        socketManager.connect()
        await loadOrganizations()
        await loadAgents()
        await loadCrews()
        await pushManager?.requestPermissionAndRegister()
    }

    func signOut() async {
        await pushManager?.unregisterToken()
        if let token = sessionStore.sessionToken {
            try? await authService.signOut(token: token)
        }
        socketManager.disconnect()
        sessionStore.clearSession()
        organizations = []
        currentOrganization = nil
        agents = []
        crews = []
    }

    // MARK: - Session Restore

    func restoreSessionIfNeeded() async {
        guard let token = sessionStore.sessionToken, !sessionStore.isAuthenticated else { return }
        if let (newToken, user) = try? await authService.getSession(token: token) {
            sessionStore.setSession(token: newToken, user: user)
            await onAuthenticated()
        } else {
            sessionStore.clearSession()
        }
    }

    // MARK: - Organizations

    func loadOrganizations() async {
        guard let orgs: OrganizationListResponse = try? await apiClient.rpc("organizations.list") else { return }
        self.organizations = orgs.organizations
        if currentOrganization == nil, let first = orgs.organizations.first {
            selectOrganization(first)
        }
    }

    func selectOrganization(_ org: Organization) {
        currentOrganization = org
        sessionStore.setOrganization(id: org.id)
        Task {
            await loadAgents()
            await loadCrews()
        }
    }

    // MARK: - Agents

    func loadAgents() async {
        guard let orgId = currentOrganization?.id else { return }
        isLoadingAgents = true
        defer { isLoadingAgents = false }

        let input = ListAgentsInput(organizationId: orgId)
        guard let response: AgentListResponse = try? await apiClient.rpc("assistants.agents.list", input: input) else { return }
        self.agents = response.agents
    }

    func startAgent(_ agentId: String) async throws {
        guard let orgId = currentOrganization?.id else { return }
        let input = AgentActionInput(agentId: agentId, organizationId: orgId)
        let _: AgentResponse = try await apiClient.rpc("assistants.agents.start", input: input)
        await loadAgents()
    }

    func stopAgent(_ agentId: String) async throws {
        guard let orgId = currentOrganization?.id else { return }
        let input = AgentActionInput(agentId: agentId, organizationId: orgId)
        let _: AgentResponse = try await apiClient.rpc("assistants.agents.stop", input: input)
        await loadAgents()
    }

    // MARK: - Crews

    func loadCrews() async {
        guard let orgId = currentOrganization?.id else { return }
        isLoadingCrews = true
        defer { isLoadingCrews = false }

        let input = ListCrewsInput(organizationId: orgId)
        guard let response: CrewListResponse = try? await apiClient.rpc("assistants.crews.list", input: input) else { return }
        self.crews = response.crews
    }

    // MARK: - Config

    private static func resolveBaseURL() -> URL {
        ThinkFleetConfig.apiBaseURL
    }
}
