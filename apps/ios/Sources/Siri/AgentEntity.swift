import AppIntents
import Foundation

struct AgentEntity: AppEntity {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Agent")
    static let defaultQuery = AgentEntityQuery()

    let id: String
    let name: String
    let statusText: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)",
            subtitle: "\(statusText)"
        )
    }
}

struct AgentEntityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [AgentEntity] {
        let all = try await fetchAgents()
        return all.filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [AgentEntity] {
        try await fetchAgents()
    }

    private func fetchAgents() async throws -> [AgentEntity] {
        let sessionStore = SessionStore()
        guard sessionStore.sessionToken != nil,
              let orgId = sessionStore.currentOrganizationId
        else { return [] }

        let apiClient = SaaSAPIClient(
            baseURL: ThinkFleetConfig.apiBaseURL,
            sessionStore: sessionStore
        )
        let input = ListAgentsInput(organizationId: orgId)
        let response: AgentListResponse = try await apiClient.rpc("assistants.list", input: input)
        return response.agents.map { agent in
            AgentEntity(
                id: agent.id,
                name: agent.name,
                statusText: agent.status.rawValue.lowercased()
            )
        }
    }
}
