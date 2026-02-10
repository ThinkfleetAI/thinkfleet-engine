import Foundation

// MARK: - Agent Models

struct Agent: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let status: AgentStatus
    let agentId: String?
    let createdAt: String
    let updatedAt: String
    let organizationId: String
    let containers: [AgentContainer]?
    let channels: [AgentChannel]?
    let healthChecks: [AgentHealthCheck]?
}

enum AgentStatus: String, Codable, Sendable {
    case PENDING
    case PROVISIONING
    case RUNNING
    case STOPPED
    case ERROR
    case DELETING
    case TERMINATED // legacy/fallback
}

struct AgentContainer: Codable, Identifiable, Sendable {
    let id: String
    let status: String
    let cpu: Double?
    let memory: Int?
    let gatewayUrl: String?
}

struct AgentChannel: Codable, Identifiable, Sendable {
    let id: String
    let type: String
    let name: String?
    let enabled: Bool

    private enum CodingKeys: String, CodingKey {
        case id
        case type = "channelType"
        case name
        case enabled = "isActive"
    }
}

struct AgentHealthCheck: Codable, Sendable {
    let id: String
    let isHealthy: Bool
    let responseTime: Int?
    let checkedAt: String?
}

// MARK: - Organization Models

struct Organization: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let slug: String?
    let logo: String?
    let isPersonal: Bool?
}

struct OrganizationMember: Codable, Identifiable, Sendable {
    let id: String
    let userId: String
    let role: String
    let user: MemberUser?
}

struct MemberUser: Codable, Sendable {
    let id: String
    let name: String?
    let email: String
    let image: String?
}

// MARK: - Task Models

struct AgentTask: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let description: String?
    let status: TaskStatus
    let labels: [String]?
    let taskType: String?
    let urgency: Int?
    let agentId: String
    let deliverables: String?
    let deliveredAt: String?
    let delegationStatus: String?
    let delegatedToAgentId: String?
    let createdAt: String
    let updatedAt: String
}

enum TaskStatus: String, Codable, Sendable {
    case todo
    case in_progress
    case delivered
    case done
    case archived
}

// MARK: - Crew Models

struct Crew: Codable, Identifiable, Sendable {
    let id: String
    let organizationId: String
    let name: String
    let description: String?
    let status: CrewStatus
    let leadAgentId: String
    let leadAgent: CrewAgentRef?
    let members: [CrewMember]?
    let createdAt: String
    let updatedAt: String
}

enum CrewStatus: String, Codable, Sendable {
    case active
    case paused
    case disbanded
}

struct CrewMember: Codable, Identifiable, Sendable {
    let id: String
    let agentId: String
    let role: String
    let agent: CrewAgentRef?
}

struct CrewAgentRef: Codable, Sendable {
    let id: String
    let name: String
    let status: AgentStatus
}

struct CrewExecution: Codable, Identifiable, Sendable {
    let id: String
    let crewId: String
    let status: String
    let objective: String?
    let startedAt: String?
    let completedAt: String?
    let createdAt: String
}

// MARK: - Attachment Models

struct TaskAttachment: Codable, Identifiable, Sendable {
    let id: String
    let taskId: String
    let filename: String
    let mimeType: String
    let fileSize: Int
    let source: String?
    let createdAt: String
}

// MARK: - Credential Models

struct CredentialInfo: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let provider: String
    let hasValue: Bool
}

// MARK: - Chat Models

struct ChatMessage: Codable, Identifiable, Sendable {
    let id: String
    var content: String
    let role: String
    let agentId: String
    let userId: String?
    let createdAt: String
    var isStreaming: Bool?

    private enum CodingKeys: String, CodingKey {
        case id, content, role, agentId, userId, createdAt
    }
}

// MARK: - Chat Event Models (Socket.IO streaming)

struct ChatEventPayload: Sendable {
    let sessionKey: String?
    let state: String // "delta", "final", "error"
    let role: String?
    let text: String?

    /// Parse from raw Socket.IO `agent:event` dictionary
    init?(from dict: [String: Any]) {
        guard let eventType = dict["event"] as? String, eventType == "chat",
              let payload = dict["payload"] as? [String: Any]
        else { return nil }

        self.sessionKey = payload["sessionKey"] as? String
        self.state = payload["state"] as? String ?? "delta"

        // Extract text from message.content[].text
        if let message = payload["message"] as? [String: Any] {
            self.role = message["role"] as? String
            if let contentArray = message["content"] as? [[String: Any]] {
                self.text = contentArray.compactMap { $0["text"] as? String }.joined()
            } else if let contentStr = message["content"] as? String {
                self.text = contentStr
            } else {
                self.text = nil
            }
        } else if let content = payload["content"] as? String {
            self.role = payload["role"] as? String
            self.text = content
        } else {
            self.role = nil
            self.text = nil
        }
    }
}

// MARK: - Chat Attachment Models

struct ChatAttachmentInput: Sendable {
    let mimeType: String
    let content: String // base64
    let fileName: String?

    var asDictionary: [String: String] {
        var dict: [String: String] = ["mimeType": mimeType, "content": content]
        if let fileName { dict["fileName"] = fileName }
        return dict
    }
}

struct ChatSaveInput: Codable {
    let agentId: String
    let organizationId: String
    let role: String
    let content: String
}

struct ChatHistoryInput: Codable {
    let agentId: String
    let organizationId: String
    let limit: Int?
}

struct ChatHistoryFullResponse: Codable {
    let messages: [ChatMessage]
    let total: Int?
    let hasMore: Bool?
}

// MARK: - RPC Input Structs

struct ListAgentsInput: Codable {
    let organizationId: String
}

struct AgentIdInput: Codable {
    let id: String
    let organizationId: String
}

struct CreateAgentInput: Codable {
    let organizationId: String
    let name: String
    let personaId: String?
    let podId: String?
}

struct AgentActionInput: Codable {
    let agentId: String
    let organizationId: String
}

struct CreateTaskInput: Codable {
    let agentId: String
    let organizationId: String
    let title: String
    let description: String?
    let status: String
    let taskType: String
    let urgency: Int
}

struct UpdateTaskInput: Codable {
    let taskId: String
    let organizationId: String
    let title: String?
    let description: String?
    let status: String?
    let urgency: Int?
}

// MARK: - RPC Response Wrappers

struct AgentListResponse: Codable {
    let agents: [Agent]
}

struct AgentResponse: Codable {
    let agent: Agent
    let hasLlmCredentials: Bool?
    let configuredCredentials: [String]?
}

struct TaskListResponse: Codable {
    let tasks: [AgentTask]
}

struct TaskResponse: Codable {
    let task: AgentTask
}

struct OrganizationListResponse: Codable {
    let organizations: [Organization]
}

struct ChatHistoryResponse: Codable {
    let messages: [ChatMessage]
}

// MARK: - Crew RPC Types

struct ListCrewsInput: Codable {
    let organizationId: String
}

struct CrewIdInput: Codable {
    let crewId: String
    let organizationId: String
}

struct CrewListResponse: Codable {
    let crews: [Crew]
}

struct CrewResponse: Codable {
    let crew: Crew
}

struct CrewExecutionListResponse: Codable {
    let executions: [CrewExecution]
}

struct CrewExecutionTasksInput: Codable {
    let executionId: String
    let organizationId: String
}

struct StartCrewExecutionInput: Codable {
    let crewId: String
    let organizationId: String
    let objective: String?
}

// MARK: - Composio Integration Models

struct ComposioApp: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let displayName: String?
    let logo: String?
    let categories: [String]?
}

struct ComposioConnection: Codable, Identifiable, Sendable {
    let id: String
    let appName: String
    let status: String
}

struct ComposioAppsInput: Codable {
    let organizationId: String
    let oauthOnly: Bool?
}

struct ComposioAppsResponse: Codable {
    let apps: [ComposioApp]
    let total: Int?
}

struct ComposioConnectionsInput: Codable {
    let organizationId: String
}

struct ComposioConnectionsResponse: Codable {
    let connections: [ComposioConnection]
}

struct ComposioConnectInput: Codable {
    let organizationId: String
    let appName: String
}

struct ComposioConnectResponse: Codable {
    let redirectUrl: String?
    let connectionId: String?
    let connected: Bool?
}

struct ComposioDisconnectInput: Codable {
    let organizationId: String
    let appName: String
}

// MARK: - Attachment RPC Types

struct AttachmentListInput: Codable {
    let agentId: String
    let organizationId: String
}

struct TaskAttachmentListInput: Codable {
    let taskId: String
    let organizationId: String
}

struct AttachmentListResponse: Codable {
    let attachments: [TaskAttachment]
}

struct AttachmentDownloadInput: Codable {
    let attachmentId: String
    let taskId: String
    let organizationId: String
}

struct AttachmentDownloadResponse: Codable {
    let downloadUrl: String
    let filename: String
    let mimeType: String
}
