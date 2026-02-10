import Foundation
import Observation
import os.log

private let appLogger = Logger(subsystem: "com.thinkfleet", category: "appstate")

@Observable
final class AppState: @unchecked Sendable {
    let sessionStore: SessionStore
    let authService: AuthService
    let apiClient: SaaSAPIClient
    let socketManager: SocketIOManager

    private(set) var isAuthenticated = false
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
        // AuthService uses its own session (we extract the token from Set-Cookie manually)
        self.authService = AuthService(baseURL: baseURL)
        // SaaSAPIClient uses a SEPARATE ephemeral session so the sign-in Set-Cookie
        // doesn't pollute its cookie jar. Its empty jar means only the manual Cookie
        // header from applyAuth() is sent — no conflicting automatic cookies.
        self.apiClient = SaaSAPIClient(baseURL: baseURL, sessionStore: sessionStore, session: URLSession(configuration: .ephemeral))
        self.socketManager = SocketIOManager(baseURL: baseURL, sessionStore: sessionStore)
    }

    // MARK: - Lifecycle

    func handleLoginSuccess(signedToken: String, rawToken: String, user: AuthUser) async {
        sessionStore.setSession(token: signedToken, rawToken: rawToken, user: user)
        isAuthenticated = true
        await onAuthenticated()
    }

    func onAuthenticated() async {
        await loadOrganizations()
        // socketManager.connect() is called by selectOrganization() during loadOrganizations()
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
        isAuthenticated = false
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
            isAuthenticated = true
            await onAuthenticated()
        } else {
            sessionStore.clearSession()
            isAuthenticated = false
        }
    }

    // MARK: - Organizations

    func loadOrganizations() async {
        // Retry with back-off — the server may need a moment to persist a fresh session token
        for attempt in 1 ... 3 {
            do {
                let orgs: OrganizationListResponse = try await apiClient.rpc("organizations.list")
                appLogger.info("Loaded \(orgs.organizations.count) organizations")
                self.organizations = orgs.organizations
                if currentOrganization == nil, let first = orgs.organizations.first {
                    appLogger.info("Selecting org: \(first.name) (\(first.id))")
                    selectOrganization(first)
                }
                return
            } catch {
                appLogger.error("loadOrganizations attempt \(attempt) failed: \(error)")
                if attempt < 3 {
                    try? await Task.sleep(for: .milliseconds(500 * attempt))
                }
            }
        }
    }

    func selectOrganization(_ org: Organization) {
        currentOrganization = org
        sessionStore.setOrganization(id: org.id)
        // Reconnect Socket.IO with new org context
        socketManager.connect()
        Task {
            await loadAgents()
            await loadCrews()
        }
    }

    // MARK: - Agents

    func loadAgents() async {
        guard let orgId = currentOrganization?.id else {
            appLogger.warning("loadAgents: no currentOrganization")
            return
        }
        isLoadingAgents = true
        defer { isLoadingAgents = false }

        do {
            let input = ListAgentsInput(organizationId: orgId)
            let response: AgentListResponse = try await apiClient.rpc("assistants.agents.list", input: input)
            appLogger.info("Loaded \(response.agents.count) agents")
            self.agents = response.agents
        } catch {
            appLogger.error("loadAgents failed: \(error)")
        }
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

        do {
            let input = ListCrewsInput(organizationId: orgId)
            let response: CrewListResponse = try await apiClient.rpc("assistants.crews.list", input: input)
            appLogger.info("Loaded \(response.crews.count) crews")
            self.crews = response.crews
        } catch {
            appLogger.error("loadCrews failed: \(error)")
        }
    }

    // MARK: - Config

    private static func resolveBaseURL() -> URL {
        ThinkFleetConfig.apiBaseURL
    }
}
