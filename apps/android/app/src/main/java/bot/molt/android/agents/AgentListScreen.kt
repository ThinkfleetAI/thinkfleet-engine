package bot.molt.android.agents

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import bot.molt.android.model.AppState
import bot.molt.android.networking.*
import kotlinx.coroutines.launch

@Composable
fun AgentListScreen(appState: AppState) {
    val agents by appState.agents.collectAsState()
    val isLoading by appState.isLoadingAgents.collectAsState()
    val currentOrg by appState.currentOrganization.collectAsState()
    val scope = rememberCoroutineScope()
    var selectedAgent by remember { mutableStateOf<Agent?>(null) }

    if (selectedAgent != null) {
        AgentDetailScreen(appState, selectedAgent!!) { selectedAgent = null }
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
        } else if (agents.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No Agents", style = MaterialTheme.typography.headlineSmall)
                    Text("Create your first agent to get started.", style = MaterialTheme.typography.bodyMedium)
                }
            }
        } else {
            LazyColumn(Modifier.padding(padding)) {
                items(agents, key = { it.id }) { agent ->
                    AgentRow(agent) { selectedAgent = agent }
                }
            }
        }
    }

    LaunchedEffect(currentOrg) {
        appState.loadAgents()
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
                            androidx.compose.material.icons.Icons.AutoMirrored.Default.ArrowBack,
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
            ScrollableTabRow(
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
                AgentDetailTab.Chat -> AgentChatTab(appState, agent)
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
    var messages by remember { mutableStateOf<List<ChatMessageItem>>(emptyList()) }
    var inputText by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(agent.id) {
        isLoading = true
        try {
            val orgId = appState.currentOrganization.value?.id ?: return@LaunchedEffect
            val response = appState.apiClient.rpc(
                "assistants.agents.chat.history",
                ChatHistoryInput(agent.id, orgId),
                ChatHistoryInput.serializer(),
                ChatHistoryResponse.serializer()
            )
            messages = response.messages
        } catch (_: Exception) { }
        isLoading = false

        // Subscribe to real-time messages
        appState.socketManager.subscribeToAgent(agent.id) { _, data ->
            val msg = ChatMessageItem(
                id = java.util.UUID.randomUUID().toString(),
                role = "assistant",
                content = data.optString("content", ""),
                timestamp = data.optString("timestamp", ""),
            )
            messages = messages + msg
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
                items(messages.reversed().size, key = { messages.reversed()[it].id }) { idx ->
                    val msg = messages.reversed()[idx]
                    ChatBubble(msg)
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
                Button(
                    onClick = {
                        val text = inputText.trim()
                        if (text.isNotEmpty()) {
                            inputText = ""
                            val userMsg = ChatMessageItem(
                                id = java.util.UUID.randomUUID().toString(),
                                role = "user",
                                content = text,
                                timestamp = "",
                            )
                            messages = messages + userMsg
                            scope.launch {
                                try {
                                    val orgId = appState.currentOrganization.value?.id ?: return@launch
                                    appState.apiClient.rpc(
                                        "assistants.agents.chat.send",
                                        ChatSendInput(agent.id, orgId, text),
                                        ChatSendInput.serializer(),
                                        ChatSendResponse.serializer()
                                    )
                                } catch (_: Exception) { }
                            }
                        }
                    },
                    enabled = inputText.isNotBlank(),
                ) { Text("Send") }
            }
        }
    }
}

@Composable
private fun ChatBubble(msg: ChatMessageItem) {
    val isUser = msg.role == "user"
    Row(
        Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            color = if (isUser) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
            shape = MaterialTheme.shapes.medium,
        ) {
            Text(
                msg.content,
                modifier = Modifier.padding(12.dp).widthIn(max = 280.dp),
                style = MaterialTheme.typography.bodyMedium,
            )
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
    var tasks by remember { mutableStateOf<List<AgentTask>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

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

    if (isLoading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    } else if (tasks.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No tasks assigned.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    } else {
        LazyColumn(Modifier.fillMaxSize()) {
            items(tasks, key = { it.id }) { task ->
                ListItem(
                    headlineContent = { Text(task.title) },
                    supportingContent = { Text(task.status.name.replace("_", " ").replaceFirstChar { it.uppercase() }) },
                )
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

private fun statusColor(status: AgentStatus): Color = when (status) {
    AgentStatus.RUNNING -> Color(0xFF4CAF50)
    AgentStatus.STOPPED -> Color.Gray
    AgentStatus.PENDING -> Color(0xFFFFC107)
    AgentStatus.ERROR -> Color(0xFFF44336)
    AgentStatus.TERMINATED -> Color.Gray
}
