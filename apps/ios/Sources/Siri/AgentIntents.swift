import AppIntents
import Foundation

// MARK: - Ask Agent Intent

struct AskAgentIntent: AppIntent {
    static let title: LocalizedStringResource = "Ask Agent"
    static let description: IntentDescription = "Send a question to one of your AI agents and get a response."

    @Parameter(title: "Agent")
    var agent: AgentEntity

    @Parameter(title: "Question")
    var question: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let sessionStore = SessionStore()
        guard sessionStore.sessionToken != nil,
              let orgId = sessionStore.currentOrganizationId
        else {
            return .result(dialog: "Please sign in to ThinkFleet first.")
        }

        let apiClient = SaaSAPIClient(
            baseURL: ThinkFleetConfig.apiBaseURL,
            sessionStore: sessionStore
        )
        let socketManager = SocketIOManager(
            baseURL: ThinkFleetConfig.apiBaseURL,
            sessionStore: sessionStore
        )

        // Connect socket and subscribe to agent events
        socketManager.connect()
        defer { socketManager.disconnect() }

        // Wait briefly for connection
        try await Task.sleep(for: .seconds(1))

        // Collect response via chat events
        var responseText = ""
        let responseReady = AsyncStream<String>.makeStream()

        socketManager.subscribeToChatEvents(agent.id) { event in
            switch event.state {
            case "delta":
                if let text = event.text { responseText += text }
            case "final":
                if responseText.isEmpty, let text = event.text { responseText = text }
                responseReady.continuation.yield(responseText)
                responseReady.continuation.finish()
            case "error":
                responseReady.continuation.yield("Error: \(event.text ?? "Unknown error")")
                responseReady.continuation.finish()
            default:
                break
            }
        }

        // Send the question via Socket.IO RPC
        _ = try await socketManager.sendRPC(
            agentId: agent.id,
            method: "chat.send",
            params: ["message": question, "sessionKey": "siri:\(agent.id)", "idempotencyKey": UUID().uuidString]
        )

        // Persist user message
        let saveInput = ChatSaveInput(agentId: agent.id, organizationId: orgId, role: "user", content: question)
        _ = try? await apiClient.rpc("assistants.chat.save", input: saveInput) as ChatMessage

        // Wait for response (timeout 30s)
        let result: String
        if let first = await responseReady.stream.first(where: { _ in true }) {
            result = first
        } else {
            result = "No response received from agent."
        }

        socketManager.unsubscribeFromAgent(agent.id)

        // Truncate for Siri dialog (max ~500 chars)
        let displayResult = result.count > 500 ? String(result.prefix(497)) + "..." : result
        return .result(dialog: "\(displayResult)")
    }
}

// MARK: - Check Agent Status Intent

struct CheckAgentStatusIntent: AppIntent {
    static let title: LocalizedStringResource = "Check Agent Status"
    static let description: IntentDescription = "Check the current status of one of your AI agents."

    @Parameter(title: "Agent")
    var agent: AgentEntity

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let sessionStore = SessionStore()
        guard sessionStore.sessionToken != nil,
              let orgId = sessionStore.currentOrganizationId
        else {
            return .result(dialog: "Please sign in to ThinkFleet first.")
        }

        let apiClient = SaaSAPIClient(
            baseURL: ThinkFleetConfig.apiBaseURL,
            sessionStore: sessionStore
        )
        let input = AgentIdInput(id: agent.id, organizationId: orgId)
        let response: AgentResponse = try await apiClient.rpc("assistants.get", input: input)

        let name = response.agent.name
        let status = response.agent.status.rawValue.lowercased()
        let hasKeys = response.hasLlmCredentials == true ? "has LLM credentials" : "no LLM credentials"

        return .result(dialog: "\(name) is \(status). It \(hasKeys).")
    }
}

// MARK: - List Agents Intent

struct ListAgentsIntent: AppIntent {
    static let title: LocalizedStringResource = "List Agents"
    static let description: IntentDescription = "List all your AI agents and their statuses."

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let sessionStore = SessionStore()
        guard sessionStore.sessionToken != nil,
              let orgId = sessionStore.currentOrganizationId
        else {
            return .result(dialog: "Please sign in to ThinkFleet first.")
        }

        let apiClient = SaaSAPIClient(
            baseURL: ThinkFleetConfig.apiBaseURL,
            sessionStore: sessionStore
        )
        let input = ListAgentsInput(organizationId: orgId)
        let response: AgentListResponse = try await apiClient.rpc("assistants.list", input: input)

        if response.agents.isEmpty {
            return .result(dialog: "You don't have any agents yet.")
        }

        let lines = response.agents.map { "\($0.name): \($0.status.rawValue.lowercased())" }
        let summary = "You have \(response.agents.count) agent\(response.agents.count == 1 ? "" : "s"):\n" + lines.joined(separator: "\n")
        return .result(dialog: "\(summary)")
    }
}
