package bot.molt.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import bot.molt.android.agents.AgentListScreen
import bot.molt.android.crews.CrewChatScreen
import bot.molt.android.model.AppState
import bot.molt.android.networking.*
import kotlinx.coroutines.launch

@Composable
fun ChatRootScreen(appState: AppState) {
    val agents by appState.agents.collectAsState()
    val crews by appState.crews.collectAsState()
    var selectedMode by remember { mutableStateOf(0) } // 0 = Agents, 1 = Crews
    var selectedAgent by remember { mutableStateOf<Agent?>(null) }
    var selectedCrew by remember { mutableStateOf<Crew?>(null) }

    if (selectedAgent != null) {
        AgentChatFullScreen(appState, selectedAgent!!) { selectedAgent = null }
        return
    }

    if (selectedCrew != null) {
        CrewChatScreen(appState, selectedCrew!!) { selectedCrew = null }
        return
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Chat") }) }
    ) { padding ->
        Column(Modifier.padding(padding)) {
            // Agents / Crews toggle
            PrimaryTabRow(selectedTabIndex = selectedMode) {
                Tab(selected = selectedMode == 0, onClick = { selectedMode = 0 }) {
                    Text("Agents", modifier = Modifier.padding(vertical = 12.dp))
                }
                Tab(selected = selectedMode == 1, onClick = { selectedMode = 1 }) {
                    Text("Crews", modifier = Modifier.padding(vertical = 12.dp))
                }
            }

            if (selectedMode == 0) {
                // Agent list for chat
                if (agents.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.ChatBubble,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(8.dp))
                            Text("No agents available", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                } else {
                    agents.forEach { agent ->
                        ListItem(
                            headlineContent = { Text(agent.name) },
                            supportingContent = {
                                Text(
                                    agent.status.name.lowercase().replaceFirstChar { it.uppercase() },
                                    color = agentStatusColor(agent.status),
                                )
                            },
                            leadingContent = {
                                Surface(
                                    color = agentStatusColor(agent.status),
                                    shape = MaterialTheme.shapes.small,
                                    modifier = Modifier.size(10.dp),
                                ) {}
                            },
                            trailingContent = {
                                Icon(Icons.Default.ChevronRight, contentDescription = null)
                            },
                            modifier = Modifier.clickable { selectedAgent = agent },
                        )
                        HorizontalDivider()
                    }
                }
            } else {
                // Crew list for chat
                if (crews.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.Groups,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(8.dp))
                            Text("No crews available", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                } else {
                    crews.forEach { crew ->
                        ListItem(
                            headlineContent = { Text(crew.name) },
                            supportingContent = {
                                val memberCount = crew.members?.size ?: 0
                                Text("$memberCount members · ${crew.status.name}")
                            },
                            leadingContent = {
                                Icon(Icons.Default.Groups, contentDescription = null)
                            },
                            trailingContent = {
                                Icon(Icons.Default.ChevronRight, contentDescription = null)
                            },
                            modifier = Modifier.clickable { selectedCrew = crew },
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}

@Composable
fun AgentChatFullScreen(appState: AppState, agent: Agent, onBack: () -> Unit) {
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

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(agent.name)
                        Text(
                            agent.status.name.lowercase().replaceFirstChar { it.uppercase() },
                            style = MaterialTheme.typography.bodySmall,
                            color = agentStatusColor(agent.status),
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                },
            )
        }
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            if (isLoading) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (messages.isEmpty()) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.ChatBubble,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text("Send a message to start chatting", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                androidx.compose.foundation.lazy.LazyColumn(
                    Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp),
                    reverseLayout = true,
                ) {
                    items(messages.reversed().size, key = { messages.reversed()[it].id }) { idx ->
                        val msg = messages.reversed()[idx]
                        val isUser = msg.role == "user"
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
                        ) {
                            Surface(
                                color = if (isUser) MaterialTheme.colorScheme.primaryContainer
                                else MaterialTheme.colorScheme.surfaceVariant,
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
                }
            }

            HorizontalDivider()
            Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Message ${agent.name}...") },
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
                                        "assistants.chats.send",
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

private fun agentStatusColor(status: AgentStatus): androidx.compose.ui.graphics.Color = when (status) {
    AgentStatus.RUNNING -> androidx.compose.ui.graphics.Color(0xFF4CAF50)
    AgentStatus.STOPPED -> androidx.compose.ui.graphics.Color.Gray
    AgentStatus.PENDING -> androidx.compose.ui.graphics.Color(0xFFFFC107)
    AgentStatus.ERROR -> androidx.compose.ui.graphics.Color(0xFFF44336)
    AgentStatus.TERMINATED -> androidx.compose.ui.graphics.Color.Gray
}
