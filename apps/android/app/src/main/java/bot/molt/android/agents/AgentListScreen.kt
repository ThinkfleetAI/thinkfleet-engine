package bot.molt.android.agents

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import bot.molt.android.crews.CrewChatScreen
import bot.molt.android.crews.CrewDetailScreen
import bot.molt.android.crews.CrewStatusChip
import bot.molt.android.model.AppState
import bot.molt.android.networking.*
import kotlinx.coroutines.launch

@Composable
fun AgentListScreen(appState: AppState) {
    val agents by appState.agents.collectAsState()
    val crews by appState.crews.collectAsState()
    val isLoading by appState.isLoadingAgents.collectAsState()
    val currentOrg by appState.currentOrganization.collectAsState()
    val scope = rememberCoroutineScope()
    var selectedAgent by remember { mutableStateOf<Agent?>(null) }
    var selectedCrewId by remember { mutableStateOf<String?>(null) }
    var crewForChat by remember { mutableStateOf<Crew?>(null) }

    if (selectedAgent != null) {
        AgentDetailScreen(appState, selectedAgent!!) { selectedAgent = null }
        return
    }

    if (crewForChat != null) {
        CrewChatScreen(appState, crewForChat!!) { crewForChat = null }
        return
    }

    if (selectedCrewId != null) {
        CrewDetailScreen(appState, selectedCrewId!!, onBack = { selectedCrewId = null }) { crew ->
            selectedCrewId = null
            crewForChat = crew
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(currentOrg?.name ?: "Agents") },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { /* Create agent */ }) {
                Icon(Icons.Default.Add, contentDescription = "New Agent")
            }
        }
    ) { padding ->
        if (isLoading && agents.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (agents.isEmpty() && crews.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No Agents", style = MaterialTheme.typography.headlineSmall)
                    Text("Create your first agent to get started.", style = MaterialTheme.typography.bodyMedium)
                }
            }
        } else {
            var isRefreshing by remember { mutableStateOf(false) }
            PullToRefreshBox(
                isRefreshing = isRefreshing,
                onRefresh = {
                    isRefreshing = true
                    scope.launch {
                        appState.loadAgents()
                        appState.loadCrews()
                        isRefreshing = false
                    }
                },
                modifier = Modifier.padding(padding),
            ) {
                LazyColumn(Modifier.fillMaxSize()) {
                    // Agents section
                    if (agents.isNotEmpty()) {
                        item {
                            Text(
                                "Agents",
                                style = MaterialTheme.typography.titleSmall,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            )
                        }
                        items(agents, key = { it.id }) { agent ->
                            AgentRow(agent) { selectedAgent = agent }
                        }
                    }

                    // Crews section
                    if (crews.isNotEmpty()) {
                        item {
                            Text(
                                "Crews",
                                style = MaterialTheme.typography.titleSmall,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            )
                        }
                        items(crews, key = { it.id }) { crew ->
                            CrewRow(crew) { selectedCrewId = crew.id }
                        }
                    }
                }
            }
        }
    }

    LaunchedEffect(currentOrg) {
        appState.loadAgents()
        appState.loadCrews()
    }
}

@Composable
private fun AgentRow(agent: Agent, onClick: () -> Unit) {
    ListItem(
        modifier = Modifier.clickable(onClick = onClick),
        headlineContent = { Text(agent.name) },
        supportingContent = {
            Text(
                agent.status.name.lowercase().replaceFirstChar { it.uppercase() },
                color = statusColor(agent.status),
            )
        },
        leadingContent = {
            Box(
                Modifier.size(12.dp).clip(CircleShape)
                    .then(Modifier.padding(0.dp))
            ) {
                Surface(
                    color = statusColor(agent.status),
                    modifier = Modifier.fillMaxSize(),
                    shape = CircleShape,
                ) {}
            }
        },
        trailingContent = {
            agent.containers?.let {
                if (it.isNotEmpty()) {
                    Text("${it.size} inst.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    )
    HorizontalDivider()
}

enum class AgentDetailTab(val label: String) {
    Chat("Chat"),
    Overview("Overview"),
    Tasks("Tasks"),
    Channels("Channels"),
    Logs("Logs"),
    Config("Config"),
}

@Composable
fun AgentDetailScreen(appState: AppState, agent: Agent, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var actionError by remember { mutableStateOf<String?>(null) }
    var selectedTab by remember { mutableStateOf(AgentDetailTab.Chat) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(agent.name) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                },
                actions = {
                    when (agent.status) {
                        AgentStatus.STOPPED, AgentStatus.ERROR -> {
                            TextButton(onClick = {
                                scope.launch {
                                    try { appState.startAgent(agent.id) }
                                    catch (e: Exception) { actionError = e.message }
                                }
                            }) { Text("Start") }
                        }
                        AgentStatus.RUNNING -> {
                            TextButton(onClick = {
                                scope.launch {
                                    try { appState.stopAgent(agent.id) }
                                    catch (e: Exception) { actionError = e.message }
                                }
                            }) { Text("Stop") }
                        }
                        else -> {}
                    }
                }
            )
        }
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            // Status header
            ListItem(
                headlineContent = {
                    Text(
                        agent.status.name.lowercase().replaceFirstChar { it.uppercase() },
                        color = statusColor(agent.status),
                    )
                },
                leadingContent = {
                    Surface(color = statusColor(agent.status), shape = CircleShape, modifier = Modifier.size(10.dp)) {}
                },
            )

            actionError?.let {
                Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(horizontal = 16.dp))
            }

            // Tab row
            PrimaryScrollableTabRow(
                selectedTabIndex = AgentDetailTab.entries.indexOf(selectedTab),
                edgePadding = 8.dp,
            ) {
                AgentDetailTab.entries.forEach { tab ->
                    Tab(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        text = { Text(tab.label) },
                    )
                }
            }

            // Tab content
            when (selectedTab) {
                AgentDetailTab.Chat -> bot.molt.android.ui.AgentChatContent(appState, agent)
                AgentDetailTab.Overview -> AgentOverviewTab(agent)
                AgentDetailTab.Tasks -> AgentTasksTab(appState, agent.id)
                AgentDetailTab.Channels -> AgentChannelsTab(agent)
                AgentDetailTab.Logs -> AgentLogsTab(appState, agent.id)
                AgentDetailTab.Config -> AgentConfigTab(agent)
            }
        }
    }
}

@Composable
private fun AgentChatTab(appState: AppState, agent: Agent) {
    var messages by remember { mutableStateOf<List<ChatMessage>>(emptyList()) }
    var inputText by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }
    var isStreaming by remember { mutableStateOf(false) }
    var streamingMessageId by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(agent.id) {
        isLoading = true
        try {
            val orgId = appState.currentOrganization.value?.id ?: return@LaunchedEffect
            val response = appState.apiClient.rpc(
                "assistants.chat.history",
                ChatHistoryInput(agent.id, orgId, limit = 50),
                ChatHistoryInput.serializer(),
                ChatHistoryResponse.serializer()
            )
            messages = response.messages
        } catch (_: Exception) { }
        isLoading = false

        // Subscribe to typed chat events
        appState.socketManager.subscribeToChatEvents(agent.id) { event ->
            val text = event.text
            val role = event.role ?: "assistant"

            when (event.state) {
                "delta" -> {
                    if (!text.isNullOrEmpty()) {
                        isStreaming = true
                        val sid = streamingMessageId
                        if (sid != null) {
                            messages = messages.map { msg ->
                                if (msg.id == sid) msg.copy(content = msg.content + text) else msg
                            }
                        } else {
                            val newId = java.util.UUID.randomUUID().toString()
                            streamingMessageId = newId
                            messages = messages + ChatMessage(
                                id = newId, content = text, role = role,
                                agentId = agent.id, createdAt = ""
                            )
                        }
                    }
                }
                "final" -> {
                    isStreaming = false
                    if (streamingMessageId == null && !text.isNullOrEmpty()) {
                        messages = messages + ChatMessage(
                            id = java.util.UUID.randomUUID().toString(),
                            content = text, role = role,
                            agentId = agent.id, createdAt = ""
                        )
                    }
                    streamingMessageId = null
                }
                "error" -> {
                    isStreaming = false
                    streamingMessageId = null
                    messages = messages + ChatMessage(
                        id = java.util.UUID.randomUUID().toString(),
                        content = "Error: ${text ?: "Unknown error"}",
                        role = "system", agentId = agent.id, createdAt = ""
                    )
                }
            }
        }
    }

    DisposableEffect(agent.id) {
        onDispose { appState.socketManager.unsubscribeFromAgent(agent.id) }
    }

    Column(Modifier.fillMaxSize()) {
        if (isLoading) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (messages.isEmpty() && agent.status != AgentStatus.RUNNING) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("Start this agent to begin chatting.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            androidx.compose.foundation.lazy.LazyColumn(
                Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp),
                reverseLayout = true,
            ) {
                val reversed = messages.reversed()
                items(reversed.size, key = { reversed[it].id }) { idx ->
                    val msg = reversed[idx]
                    ChatBubble(msg, isStreaming = msg.id == streamingMessageId)
                }
            }
        }

        // Input bar
        if (agent.status == AgentStatus.RUNNING) {
            HorizontalDivider()
            Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Message...") },
                    singleLine = true,
                )
                Spacer(Modifier.width(8.dp))
                if (isStreaming) {
                    CircularProgressIndicator(modifier = Modifier.size(36.dp))
                } else {
                    Button(
                        onClick = {
                            val text = inputText.trim()
                            if (text.isNotEmpty()) {
                                inputText = ""
                                messages = messages + ChatMessage(
                                    id = java.util.UUID.randomUUID().toString(),
                                    content = text, role = "user",
                                    agentId = agent.id, createdAt = ""
                                )
                                scope.launch {
                                    try {
                                        appState.socketManager.sendRPC(
                                            agentId = agent.id,
                                            method = "chat.send",
                                            params = mapOf("message" to text, "sessionKey" to "mobile:${agent.id}", "idempotencyKey" to java.util.UUID.randomUUID().toString())
                                        )
                                    } catch (e: Exception) {
                                        messages = messages + ChatMessage(
                                            id = java.util.UUID.randomUUID().toString(),
                                            content = "Failed to send: ${e.message}",
                                            role = "system", agentId = agent.id, createdAt = ""
                                        )
                                    }
                                }
                            }
                        },
                        enabled = inputText.isNotBlank(),
                    ) { Text("Send") }
                }
            }
        }
    }
}

@Composable
private fun ChatBubble(msg: ChatMessage, isStreaming: Boolean = false) {
    val isUser = msg.role == "user"
    val isSystem = msg.role == "system"
    Row(
        Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            color = when {
                isSystem -> MaterialTheme.colorScheme.errorContainer
                isUser -> MaterialTheme.colorScheme.primaryContainer
                else -> MaterialTheme.colorScheme.surfaceVariant
            },
            shape = MaterialTheme.shapes.medium,
        ) {
            Row(
                Modifier.padding(12.dp).widthIn(max = 280.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    msg.content,
                    modifier = Modifier.weight(1f, fill = false),
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (isStreaming) {
                    Spacer(Modifier.width(8.dp))
                    CircularProgressIndicator(modifier = Modifier.size(12.dp), strokeWidth = 2.dp)
                }
            }
        }
    }
}

@Composable
private fun AgentOverviewTab(agent: Agent) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        ListItem(headlineContent = { Text("Status") }, trailingContent = { Text(agent.status.name.lowercase().replaceFirstChar { it.uppercase() }) })
        HorizontalDivider()
        ListItem(headlineContent = { Text("Created") }, trailingContent = { Text(agent.createdAt) })
        HorizontalDivider()
        agent.containers?.let {
            ListItem(headlineContent = { Text("Instances") }, trailingContent = { Text("${it.size}") })
            HorizontalDivider()
        }
        agent.channels?.let {
            ListItem(headlineContent = { Text("Channels") }, trailingContent = { Text("${it.size}") })
            HorizontalDivider()
        }
    }
}

@Composable
private fun AgentTasksTab(appState: AppState, agentId: String) {
    val agents by appState.agents.collectAsState()
    var tasks by remember { mutableStateOf<List<AgentTask>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedTask by remember { mutableStateOf<AgentTask?>(null) }

    LaunchedEffect(agentId) {
        isLoading = true
        try {
            val orgId = appState.currentOrganization.value?.id ?: return@LaunchedEffect
            val response = appState.apiClient.rpc(
                "assistants.tasks.list",
                TaskListInput(agentId, orgId),
                TaskListInput.serializer(),
                TaskListResponse.serializer()
            )
            tasks = response.tasks
        } catch (_: Exception) { }
        isLoading = false
    }

    selectedTask?.let { task ->
        bot.molt.android.tasks.TaskDetailScreen(task = task, agents = agents, onBack = { selectedTask = null }, appState = appState)
        return
    }

    if (isLoading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    } else if (tasks.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No tasks assigned.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    } else {
        LazyColumn(Modifier.fillMaxSize()) {
            items(tasks, key = { it.id }) { task ->
                bot.molt.android.tasks.TaskRow(task, agents, onClick = { selectedTask = task })
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun AgentChannelsTab(agent: Agent) {
    val channels = agent.channels
    if (channels.isNullOrEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No channels configured.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    } else {
        LazyColumn(Modifier.fillMaxSize()) {
            items(channels, key = { it.id }) { channel ->
                ListItem(
                    headlineContent = { Text(channel.name ?: channel.type) },
                    supportingContent = { Text(channel.type) },
                )
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun AgentLogsTab(appState: AppState, agentId: String) {
    var logs by remember { mutableStateOf<List<LogEntry>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(agentId) {
        isLoading = true
        try {
            val orgId = appState.currentOrganization.value?.id ?: return@LaunchedEffect
            val response = appState.apiClient.rpc(
                "assistants.agents.logs",
                LogsInput(agentId, orgId),
                LogsInput.serializer(),
                LogsResponse.serializer()
            )
            logs = response.logs
        } catch (_: Exception) { }
        isLoading = false
    }

    if (isLoading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    } else if (logs.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No log entries.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    } else {
        LazyColumn(Modifier.fillMaxSize()) {
            items(logs, key = { it.id }) { entry ->
                ListItem(
                    overlineContent = {
                        Text(
                            entry.level.uppercase(),
                            color = logLevelColor(entry.level),
                            style = MaterialTheme.typography.labelSmall,
                        )
                    },
                    headlineContent = { Text(entry.message, maxLines = 3) },
                    supportingContent = { Text(entry.timestamp, style = MaterialTheme.typography.bodySmall) },
                )
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun AgentConfigTab(agent: Agent) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        ListItem(headlineContent = { Text("Name") }, trailingContent = { Text(agent.name) })
        HorizontalDivider()
        ListItem(headlineContent = { Text("ID") }, supportingContent = { Text(agent.id, style = MaterialTheme.typography.bodySmall) })
        HorizontalDivider()
        ListItem(headlineContent = { Text("Status") }, trailingContent = { Text(agent.status.name.lowercase().replaceFirstChar { it.uppercase() }) })
        HorizontalDivider()
        Spacer(Modifier.height(16.dp))
        Text(
            "Full configuration editing is available in the web dashboard.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

private fun logLevelColor(level: String): Color = when (level.lowercase()) {
    "error" -> Color(0xFFF44336)
    "warn", "warning" -> Color(0xFFFF9800)
    "info" -> Color(0xFF2196F3)
    "debug" -> Color.Gray
    else -> Color.Unspecified
}

@Composable
private fun CrewRow(crew: Crew, onClick: () -> Unit) {
    ListItem(
        modifier = Modifier.clickable(onClick = onClick),
        headlineContent = { Text(crew.name) },
        supportingContent = {
            val memberCount = crew.members?.size ?: 0
            Text("$memberCount member${if (memberCount != 1) "s" else ""}")
        },
        leadingContent = {
            CrewStatusChip(crew.status)
        },
        trailingContent = {
            crew.leadAgent?.let {
                Text(it.name, style = MaterialTheme.typography.bodySmall, color = Color.Gray)
            }
        },
    )
    HorizontalDivider()
}

private fun statusColor(status: AgentStatus): Color = when (status) {
    AgentStatus.RUNNING -> Color(0xFF4CAF50)
    AgentStatus.STOPPED -> Color.Gray
    AgentStatus.PENDING -> Color(0xFFFFC107)
    AgentStatus.PROVISIONING -> Color(0xFFFFC107)
    AgentStatus.ERROR -> Color(0xFFF44336)
    AgentStatus.DELETING -> Color(0xFFF44336)
    AgentStatus.TERMINATED -> Color.Gray
}
