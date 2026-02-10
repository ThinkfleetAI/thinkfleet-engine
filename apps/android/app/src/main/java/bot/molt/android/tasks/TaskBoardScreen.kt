package bot.molt.android.tasks

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.automirrored.filled.Label
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import bot.molt.android.model.AppState
import bot.molt.android.networking.*
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

enum class SourceMode { All, Agent, Crew }

@Composable
fun TaskBoardScreen(appState: AppState) {
    val agents by appState.agents.collectAsState()
    val crews by appState.crews.collectAsState()
    var tasks by remember { mutableStateOf<List<AgentTask>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedFilter by remember { mutableStateOf<TaskStatus?>(null) }
    var sourceMode by remember { mutableStateOf(SourceMode.All) }
    var selectedAgentId by remember { mutableStateOf<String?>(null) }
    var selectedCrewId by remember { mutableStateOf<String?>(null) }
    var showCreateTask by remember { mutableStateOf(false) }
    var selectedTask by remember { mutableStateOf<AgentTask?>(null) }
    val scope = rememberCoroutineScope()

    // Show task detail screen if a task is selected
    selectedTask?.let { task ->
        TaskDetailScreen(task = task, agents = agents, onBack = { selectedTask = null }, appState = appState)
        return
    }

    val filteredTasks = tasks
        .let { list ->
            when (sourceMode) {
                SourceMode.Agent -> selectedAgentId?.let { id -> list.filter { it.agentId == id } } ?: list
                else -> list
            }
        }
        .let { list ->
            selectedFilter?.let { filter -> list.filter { it.status == filter } } ?: list
        }

    suspend fun loadTasks() {
        val orgId = appState.currentOrganization.value?.id ?: return
        isLoading = true
        try {
            val response = appState.apiClient.rpc(
                "assistants.tasks.listByOrg",
                ListAgentsInput(orgId),
                ListAgentsInput.serializer(),
                TaskListResponse.serializer()
            )
            tasks = response.tasks
        } catch (_: Exception) { }
        isLoading = false
    }

    LaunchedEffect(appState.currentOrganization.value) {
        loadTasks()
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Tasks") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { showCreateTask = true }) {
                Icon(Icons.Default.Add, contentDescription = "New Task")
            }
        }
    ) { padding ->
        Column(Modifier.padding(padding)) {
            // Source selector (All / Agent / Crew pills)
            if (agents.isNotEmpty() || crews.isNotEmpty()) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(vertical = 6.dp),
                ) {
                    item {
                        FilterChip(
                            selected = sourceMode == SourceMode.All,
                            onClick = {
                                sourceMode = SourceMode.All
                                selectedAgentId = null
                                selectedCrewId = null
                            },
                            label = { Text("All") },
                        )
                    }
                    items(agents, key = { it.id }) { agent ->
                        FilterChip(
                            selected = sourceMode == SourceMode.Agent && selectedAgentId == agent.id,
                            onClick = {
                                sourceMode = SourceMode.Agent
                                selectedAgentId = agent.id
                                selectedCrewId = null
                            },
                            label = { Text(agent.name) },
                        )
                    }
                    items(crews, key = { it.id }) { crew ->
                        FilterChip(
                            selected = sourceMode == SourceMode.Crew && selectedCrewId == crew.id,
                            onClick = {
                                sourceMode = SourceMode.Crew
                                selectedCrewId = crew.id
                                selectedAgentId = null
                            },
                            label = { Text(crew.name) },
                        )
                    }
                }
            }

            // Status filter chips
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(vertical = 6.dp),
            ) {
                item {
                    FilterChip(
                        selected = selectedFilter == null,
                        onClick = { selectedFilter = null },
                        label = { Text("All") },
                    )
                }
                items(listOf(TaskStatus.todo, TaskStatus.in_progress, TaskStatus.delivered, TaskStatus.done)) { status ->
                    FilterChip(
                        selected = selectedFilter == status,
                        onClick = { selectedFilter = if (selectedFilter == status) null else status },
                        label = { Text(status.displayName()) },
                    )
                }
            }

            HorizontalDivider()

            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (filteredTasks.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Checklist,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text("No Tasks", style = MaterialTheme.typography.headlineSmall)
                        Text("Create a task to get started.")
                    }
                }
            } else {
                var isRefreshing by remember { mutableStateOf(false) }
                PullToRefreshBox(
                    isRefreshing = isRefreshing,
                    onRefresh = {
                        isRefreshing = true
                        scope.launch {
                            loadTasks()
                            isRefreshing = false
                        }
                    },
                ) {
                    LazyColumn(Modifier.fillMaxSize()) {
                        items(filteredTasks, key = { it.id }) { task ->
                            TaskRow(task, agents, onClick = { selectedTask = task })
                            HorizontalDivider()
                        }
                    }
                }
            }
        }
    }

    // Create task dialog
    if (showCreateTask) {
        CreateTaskDialog(
            appState = appState,
            agents = agents,
            onDismiss = { showCreateTask = false },
            onCreated = {
                showCreateTask = false
                scope.launch { loadTasks() }
            },
        )
    }
}

@Composable
fun TaskRow(task: AgentTask, agents: List<Agent>, onClick: (() -> Unit)? = null) {
    val assignedAgentName = if (task.delegatedToAgentId != null) {
        agents.find { it.id == task.delegatedToAgentId }?.name
    } else {
        agents.find { it.id == task.agentId }?.name
    }

    ListItem(
        modifier = if (onClick != null) Modifier.clickable { onClick() } else Modifier,
        headlineContent = { Text(task.title, maxLines = 2) },
        supportingContent = {
            Column {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        task.status.displayName(),
                        color = task.status.color(),
                        style = MaterialTheme.typography.bodySmall,
                    )
                    task.urgency?.let {
                        Text(
                            urgencyLabel(it),
                            style = MaterialTheme.typography.bodySmall,
                            color = urgencyColor(it),
                        )
                    }
                    task.delegationStatus?.takeIf { it.isNotEmpty() }?.let {
                        Surface(
                            color = Color(0xFF9C27B0).copy(alpha = 0.15f),
                            shape = MaterialTheme.shapes.small,
                        ) {
                            Text(
                                it,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFF9C27B0),
                            )
                        }
                    }
                }
                assignedAgentName?.let { name ->
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Default.Memory,
                            contentDescription = null,
                            modifier = Modifier.size(12.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            name,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        },
        leadingContent = {
            Icon(
                when (task.status) {
                    TaskStatus.todo -> Icons.Default.RadioButtonUnchecked
                    TaskStatus.in_progress -> Icons.Default.Autorenew
                    TaskStatus.delivered -> Icons.Default.LocalShipping
                    TaskStatus.done -> Icons.Default.CheckCircle
                    TaskStatus.archived -> Icons.Default.Inventory
                },
                contentDescription = null,
                tint = task.status.color(),
            )
        },
    )
}

@Composable
private fun CreateTaskDialog(
    appState: AppState,
    agents: List<Agent>,
    onDismiss: () -> Unit,
    onCreated: () -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var agentId by remember { mutableStateOf("") }
    var urgency by remember { mutableStateOf(4) }
    var isCreating by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Task") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 3,
                )

                // Urgency
                Text("Priority", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(4 to "Low", 3 to "Med", 2 to "High", 1 to "Crit").forEach { (value, label) ->
                        FilterChip(
                            selected = urgency == value,
                            onClick = { urgency = value },
                            label = { Text(label) },
                        )
                    }
                }

                errorMessage?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    scope.launch {
                        isCreating = true
                        errorMessage = null
                        val orgId = appState.currentOrganization.value?.id ?: return@launch
                        val assignedAgent = agentId.ifEmpty { agents.firstOrNull()?.id ?: "" }
                        try {
                            @kotlinx.serialization.Serializable
                            data class CreateInput(
                                val agentId: String,
                                val organizationId: String,
                                val title: String,
                                val description: String?,
                                val status: String,
                                val taskType: String,
                                val urgency: Int,
                            )
                            @kotlinx.serialization.Serializable
                            data class CreateResponse(val task: AgentTask)

                            appState.apiClient.rpc(
                                "assistants.tasks.create",
                                CreateInput(assignedAgent, orgId, title.trim(), description.ifEmpty { null }, "todo", "generic", urgency),
                                CreateInput.serializer(),
                                CreateResponse.serializer()
                            )
                            onCreated()
                        } catch (e: Exception) {
                            errorMessage = e.message
                        }
                        isCreating = false
                    }
                },
                enabled = title.trim().isNotEmpty() && !isCreating,
            ) {
                if (isCreating) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

private fun TaskStatus.displayName(): String = when (this) {
    TaskStatus.todo -> "To Do"
    TaskStatus.in_progress -> "In Progress"
    TaskStatus.delivered -> "Delivered"
    TaskStatus.done -> "Done"
    TaskStatus.archived -> "Archived"
}

private fun TaskStatus.color(): Color = when (this) {
    TaskStatus.todo -> Color.Gray
    TaskStatus.in_progress -> Color(0xFF2196F3)
    TaskStatus.delivered -> Color(0xFF9C27B0)
    TaskStatus.done -> Color(0xFF4CAF50)
    TaskStatus.archived -> Color.Gray
}

private fun urgencyLabel(urgency: Int): String = when (urgency) {
    1 -> "Critical"
    2 -> "High"
    3 -> "Medium"
    else -> "Low"
}

private fun urgencyColor(urgency: Int): Color = when (urgency) {
    1 -> Color(0xFFF44336)
    2 -> Color(0xFFFF9800)
    3 -> Color(0xFFFFC107)
    else -> Color.Gray
}

// MARK: - Task Detail

@Composable
fun TaskDetailScreen(task: AgentTask, agents: List<Agent>, onBack: () -> Unit, appState: AppState? = null) {
    val assignedAgent = if (task.delegatedToAgentId != null) {
        agents.find { it.id == task.delegatedToAgentId }
    } else {
        agents.find { it.id == task.agentId }
    }
    var showChat by remember { mutableStateOf(false) }
    var attachments by remember { mutableStateOf<List<TaskAttachment>>(emptyList()) }

    // Load attachments for this task
    LaunchedEffect(task.id) {
        val state = appState ?: return@LaunchedEffect
        val orgId = state.currentOrganization.value?.id ?: return@LaunchedEffect
        try {
            val response = state.apiClient.rpc(
                "assistants.attachments.list",
                TaskAttachmentListInput(task.id, orgId),
                TaskAttachmentListInput.serializer(),
                AttachmentListResponse.serializer()
            )
            attachments = response.attachments
        } catch (_: Exception) { }
    }

    // Show agent chat screen
    if (showChat && appState != null) {
        val agent = agents.find { it.id == task.agentId }
        if (agent != null) {
            bot.molt.android.ui.AgentChatFullScreen(
                appState = appState,
                agent = agent,
                onBack = { showChat = false },
            )
            return
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(task.title, maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .fillMaxSize()
        ) {
            // Status & Urgency
            ListItem(
                headlineContent = { Text(task.status.displayName()) },
                supportingContent = {
                    task.urgency?.let {
                        Surface(
                            color = urgencyColor(it).copy(alpha = 0.15f),
                            shape = MaterialTheme.shapes.small,
                        ) {
                            Text(
                                urgencyLabel(it),
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = urgencyColor(it),
                            )
                        }
                    }
                },
                leadingContent = {
                    Icon(
                        when (task.status) {
                            TaskStatus.todo -> Icons.Default.RadioButtonUnchecked
                            TaskStatus.in_progress -> Icons.Default.Autorenew
                            TaskStatus.delivered -> Icons.Default.LocalShipping
                            TaskStatus.done -> Icons.Default.CheckCircle
                            TaskStatus.archived -> Icons.Default.Inventory
                        },
                        contentDescription = null,
                        tint = task.status.color(),
                        modifier = Modifier.size(32.dp),
                    )
                },
            )
            HorizontalDivider()

            // Chat with Agent
            if (assignedAgent?.status == AgentStatus.RUNNING && appState != null) {
                ListItem(
                    modifier = Modifier.clickable { showChat = true },
                    headlineContent = {
                        Text("Chat with ${assignedAgent.name}", style = MaterialTheme.typography.bodyLarge.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium))
                    },
                    supportingContent = { Text("Discuss this task or provide more details") },
                    leadingContent = {
                        Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null, tint = Color(0xFF2196F3))
                    },
                    trailingContent = {
                        Icon(Icons.Default.ChevronRight, contentDescription = null)
                    },
                )
                HorizontalDivider()
            }

            // Description
            task.description?.takeIf { it.isNotEmpty() }?.let { desc ->
                Text(
                    "Description",
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
                Text(
                    desc,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
                Spacer(Modifier.height(8.dp))
                HorizontalDivider()
            }

            // Deliverables
            task.deliverables?.takeIf { it.isNotEmpty() }?.let { del ->
                Text(
                    "Deliverables",
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
                Text(
                    del,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
                Spacer(Modifier.height(8.dp))
                HorizontalDivider()
            }

            // File Attachments
            if (attachments.isNotEmpty()) {
                Text(
                    "Files",
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
                attachments.forEach { attachment ->
                    var isDownloading by remember { mutableStateOf(false) }
                    val downloadScope = rememberCoroutineScope()
                    val ctx = androidx.compose.ui.platform.LocalContext.current
                    ListItem(
                        modifier = Modifier.clickable {
                            if (isDownloading || appState == null) return@clickable
                            downloadScope.launch {
                                isDownloading = true
                                try {
                                    val orgId = appState.currentOrganization.value?.id ?: return@launch
                                    val response = appState.apiClient.rpc(
                                        "assistants.attachments.downloadUrl",
                                        AttachmentDownloadInput(attachment.id, attachment.taskId, orgId),
                                        AttachmentDownloadInput.serializer(),
                                        AttachmentDownloadResponse.serializer()
                                    )
                                    ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(response.downloadUrl)))
                                } catch (_: Exception) { }
                                isDownloading = false
                            }
                        },
                        headlineContent = { Text(attachment.filename, maxLines = 1) },
                        supportingContent = { Text(formatFileSize(attachment.fileSize)) },
                        leadingContent = {
                            Icon(
                                when {
                                    attachment.mimeType.startsWith("image/") -> Icons.Default.Image
                                    attachment.mimeType.startsWith("video/") -> Icons.Default.Videocam
                                    attachment.mimeType == "application/pdf" -> Icons.Default.PictureAsPdf
                                    else -> Icons.AutoMirrored.Filled.InsertDriveFile
                                },
                                contentDescription = null,
                                tint = Color(0xFF2196F3),
                            )
                        },
                        trailingContent = {
                            if (isDownloading) {
                                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.Download, contentDescription = "Download", tint = Color(0xFF2196F3))
                            }
                        },
                    )
                }
                HorizontalDivider()
            }

            // Details
            Text(
                "Details",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )

            assignedAgent?.let { agent ->
                ListItem(
                    headlineContent = { Text("Agent") },
                    trailingContent = { Text(agent.name) },
                    leadingContent = { Icon(Icons.Default.Memory, contentDescription = null) },
                )
            }

            task.delegationStatus?.takeIf { it.isNotEmpty() }?.let {
                ListItem(
                    headlineContent = { Text("Delegation") },
                    trailingContent = { Text(it) },
                    leadingContent = { Icon(Icons.Default.SwapHoriz, contentDescription = null) },
                )
            }

            task.taskType?.takeIf { it.isNotEmpty() }?.let {
                ListItem(
                    headlineContent = { Text("Type") },
                    trailingContent = { Text(it) },
                    leadingContent = { Icon(Icons.Default.Category, contentDescription = null) },
                )
            }

            task.labels?.takeIf { it.isNotEmpty() }?.let {
                ListItem(
                    headlineContent = { Text("Labels") },
                    trailingContent = { Text(it.joinToString(", ")) },
                    leadingContent = { Icon(Icons.AutoMirrored.Filled.Label, contentDescription = null) },
                )
            }

            HorizontalDivider()

            // Timestamps
            Text(
                "Timeline",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )

            ListItem(
                headlineContent = { Text("Created") },
                trailingContent = { Text(formatIsoDate(task.createdAt)) },
                leadingContent = { Icon(Icons.Default.CalendarMonth, contentDescription = null) },
            )
            ListItem(
                headlineContent = { Text("Updated") },
                trailingContent = { Text(formatIsoDate(task.updatedAt)) },
                leadingContent = { Icon(Icons.Default.Update, contentDescription = null) },
            )
            task.deliveredAt?.let {
                ListItem(
                    headlineContent = { Text("Delivered") },
                    trailingContent = { Text(formatIsoDate(it)) },
                    leadingContent = { Icon(Icons.Default.LocalShipping, contentDescription = null) },
                )
            }
        }
    }
}

private fun formatFileSize(bytes: Int): String {
    if (bytes < 1024) return "$bytes B"
    if (bytes < 1_048_576) return "%.1f KB".format(bytes / 1024.0)
    return "%.1f MB".format(bytes / 1_048_576.0)
}

private fun formatIsoDate(isoString: String): String {
    return try {
        val instant = Instant.parse(isoString)
        val formatter = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM)
            .withZone(ZoneId.systemDefault())
        formatter.format(instant)
    } catch (_: Exception) {
        isoString
    }
}
