package bot.molt.android.networking

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
    PENDING, RUNNING, STOPPED, TERMINATED, ERROR
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
    val type: String,
    val name: String? = null,
    val enabled: Boolean,
)

@Serializable
data class AgentHealthCheck(
    val id: String,
    val status: String,
    val responseTime: Int? = null,
    val lastCheck: String? = null,
)

// MARK: - Organization Models

@Serializable
data class Organization(
    val id: String,
    val name: String,
    val slug: String,
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
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
enum class TaskStatus {
    todo, in_progress, done, archived
}

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
data class ChatMessageItem(
    val id: String,
    val role: String,
    val content: String,
    val timestamp: String,
)

@Serializable
data class ChatHistoryInput(val agentId: String, val organizationId: String)

@Serializable
data class ChatHistoryResponse(val messages: List<ChatMessageItem>)

@Serializable
data class ChatSendInput(val agentId: String, val organizationId: String, val content: String)

@Serializable
data class ChatSendResponse(val messageId: String? = null)

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
