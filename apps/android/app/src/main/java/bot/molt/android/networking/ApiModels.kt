package bot.molt.android.networking

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// MARK: - Agent Models

@Serializable
data class Agent(
    val id: String,
    val name: String,
    val status: AgentStatus,
    val agentId: String? = null,
    val createdAt: String,
    val updatedAt: String,
    val organizationId: String,
    val containers: List<AgentContainer>? = null,
    val channels: List<AgentChannel>? = null,
    val healthChecks: List<AgentHealthCheck>? = null,
)

@Serializable
enum class AgentStatus {
    PENDING, PROVISIONING, RUNNING, STOPPED, ERROR, DELETING, TERMINATED
}

@Serializable
data class AgentContainer(
    val id: String,
    val status: String,
    val cpu: Double? = null,
    val memory: Int? = null,
    val gatewayUrl: String? = null,
)

@Serializable
data class AgentChannel(
    val id: String,
    @SerialName("channelType") val type: String,
    val name: String? = null,
    @SerialName("isActive") val enabled: Boolean,
)

@Serializable
data class AgentHealthCheck(
    val id: String,
    val isHealthy: Boolean,
    val responseTime: Int? = null,
    val checkedAt: String? = null,
)

// MARK: - Organization Models

@Serializable
data class Organization(
    val id: String,
    val name: String,
    val slug: String? = null,
    val logo: String? = null,
    val isPersonal: Boolean? = null,
)

@Serializable
data class OrganizationMember(
    val id: String,
    val userId: String,
    val role: String,
    val user: MemberUser? = null,
)

@Serializable
data class MemberUser(
    val id: String,
    val name: String? = null,
    val email: String,
    val image: String? = null,
)

// MARK: - Task Models

@Serializable
data class AgentTask(
    val id: String,
    val title: String,
    val description: String? = null,
    val status: TaskStatus,
    val labels: List<String>? = null,
    val taskType: String? = null,
    val urgency: Int? = null,
    val agentId: String,
    val deliverables: String? = null,
    val deliveredAt: String? = null,
    val delegationStatus: String? = null,
    val delegatedToAgentId: String? = null,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
enum class TaskStatus {
    todo, in_progress, delivered, done, archived
}

// MARK: - Crew Models

@Serializable
data class Crew(
    val id: String,
    val organizationId: String,
    val name: String,
    val description: String? = null,
    val status: CrewStatus,
    val leadAgentId: String,
    val leadAgent: CrewAgentRef? = null,
    val members: List<CrewMember>? = null,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
enum class CrewStatus {
    active, paused, disbanded
}

@Serializable
data class CrewMember(
    val id: String,
    val agentId: String,
    val role: String,
    val agent: CrewAgentRef? = null,
)

@Serializable
data class CrewAgentRef(
    val id: String,
    val name: String,
    val status: AgentStatus,
)

@Serializable
data class CrewExecution(
    val id: String,
    val crewId: String,
    val status: String,
    val objective: String? = null,
    val startedAt: String? = null,
    val completedAt: String? = null,
    val createdAt: String,
)

// MARK: - Attachment Models

@Serializable
data class TaskAttachment(
    val id: String,
    val taskId: String,
    val filename: String,
    val mimeType: String,
    val fileSize: Int,
    val source: String? = null,
    val createdAt: String,
)

// MARK: - Chat Models

@Serializable
data class ChatMessage(
    val id: String,
    val content: String,
    val role: String,
    val agentId: String,
    val userId: String? = null,
    val createdAt: String,
)

// MARK: - RPC Input/Output

@Serializable
data class ListAgentsInput(val organizationId: String)

@Serializable
data class AgentIdInput(val id: String, val organizationId: String)

@Serializable
data class CreateAgentInput(
    val organizationId: String,
    val name: String,
    val personaId: String? = null,
    val podId: String? = null,
)

@Serializable
data class AgentActionInput(val agentId: String, val organizationId: String)

@Serializable
data class AgentListResponse(val agents: List<Agent>)

@Serializable
data class AgentResponse(
    val agent: Agent,
    val hasLlmCredentials: Boolean? = null,
    val configuredCredentials: List<String>? = null,
)

@Serializable
data class OrganizationListResponse(val organizations: List<Organization>)

@Serializable
data class ChatHistoryInput(val agentId: String, val organizationId: String, val limit: Int? = null)

@Serializable
data class ChatHistoryResponse(
    val messages: List<ChatMessage>,
    val total: Int? = null,
    val hasMore: Boolean? = null,
)

@Serializable
data class ChatSaveInput(val agentId: String, val organizationId: String, val role: String, val content: String)

@Serializable
data class TaskListResponse(val tasks: List<AgentTask>)

@Serializable
data class TaskListInput(val agentId: String, val organizationId: String)

@Serializable
data class LogEntry(val id: String, val level: String, val message: String, val timestamp: String)

@Serializable
data class LogsInput(val agentId: String, val organizationId: String)

@Serializable
data class LogsResponse(val logs: List<LogEntry>)

// MARK: - Crew RPC Types

@Serializable
data class ListCrewsInput(val organizationId: String)

@Serializable
data class CrewIdInput(val crewId: String, val organizationId: String)

@Serializable
data class CrewListResponse(val crews: List<Crew>)

@Serializable
data class CrewResponse(val crew: Crew)

@Serializable
data class CrewExecutionListResponse(val executions: List<CrewExecution>)

@Serializable
data class CrewExecutionTasksInput(val executionId: String, val organizationId: String)

@Serializable
data class StartCrewExecutionInput(val crewId: String, val organizationId: String, val objective: String? = null)

// MARK: - Composio Integration Models

@Serializable
data class ComposioApp(
    val id: String,
    val name: String,
    val displayName: String? = null,
    val logo: String? = null,
    val categories: List<String>? = null,
)

@Serializable
data class ComposioConnection(
    val id: String,
    val appName: String,
    val status: String,
)

@Serializable
data class ComposioAppsInput(val organizationId: String, val oauthOnly: Boolean? = null)

@Serializable
data class ComposioAppsResponse(val apps: List<ComposioApp>, val total: Int? = null)

@Serializable
data class ComposioConnectionsInput(val organizationId: String)

@Serializable
data class ComposioConnectionsResponse(val connections: List<ComposioConnection>)

@Serializable
data class ComposioConnectInput(val organizationId: String, val appName: String)

@Serializable
data class ComposioConnectResponse(val redirectUrl: String? = null, val connectionId: String? = null, val connected: Boolean? = null)

@Serializable
data class ComposioDisconnectInput(val organizationId: String, val appName: String)

// MARK: - Attachment RPC Types

@Serializable
data class AttachmentListInput(val agentId: String, val organizationId: String)

@Serializable
data class TaskAttachmentListInput(val taskId: String, val organizationId: String)

@Serializable
data class AttachmentListResponse(val attachments: List<TaskAttachment>)

@Serializable
data class AttachmentDownloadInput(val attachmentId: String, val taskId: String, val organizationId: String)

@Serializable
data class AttachmentDownloadResponse(val downloadUrl: String, val filename: String, val mimeType: String)
