package bot.molt.android.tasks

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
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
    val scope = rememberCoroutineScope()

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
                "assistants.tasks.list",
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
                            TaskRow(task, agents)
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
private fun TaskRow(task: AgentTask, agents: List<Agent>) {
    val assignedAgentName = if (task.delegatedToAgentId != null) {
        agents.find { it.id == task.delegatedToAgentId }?.name
    } else {
        agents.find { it.id == task.agentId }?.name
    }

    ListItem(
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
