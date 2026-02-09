package bot.molt.android.crews

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import bot.molt.android.model.AppState
import bot.molt.android.networking.*
import kotlinx.coroutines.launch

data class CrewChatMessage(
    val id: String,
    val text: String,
    val isUser: Boolean,
    val agentId: String? = null,
    val agentName: String? = null,
)

@Composable
fun CrewChatScreen(appState: AppState, crew: Crew, onBack: () -> Unit) {
    var messages by remember { mutableStateOf<List<CrewChatMessage>>(emptyList()) }
    var inputText by remember { mutableStateOf("") }
    var showMentionPicker by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val members = crew.members ?: emptyList()
    val runningMembers = members.filter { it.agent?.status == AgentStatus.RUNNING }

    // Subscribe to all crew member agents
    LaunchedEffect(crew.id) {
        members.forEach { member ->
            member.agent?.let { agent ->
                appState.socketManager.subscribeToAgent(agent.id) { agentId, data ->
                    val agentName = members.find { it.agentId == agentId }?.agent?.name ?: "Agent"
                    val msg = CrewChatMessage(
                        id = java.util.UUID.randomUUID().toString(),
                        text = data.optString("content", ""),
                        isUser = false,
                        agentId = agentId,
                        agentName = agentName,
                    )
                    messages = messages + msg
                }
            }
        }
    }

    DisposableEffect(crew.id) {
        onDispose {
            members.forEach { member ->
                member.agent?.let { appState.socketManager.unsubscribeFromAgent(it.id) }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(crew.name) },
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
            // Member status bar
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(vertical = 6.dp),
            ) {
                items(members, key = { it.id }) { member ->
                    member.agent?.let { agent ->
                        Surface(
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            shape = MaterialTheme.shapes.small,
                        ) {
                            Row(
                                Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                Surface(
                                    color = when (agent.status) {
                                        AgentStatus.RUNNING -> Color(0xFF4CAF50)
                                        AgentStatus.ERROR -> Color(0xFFF44336)
                                        else -> Color.Gray
                                    },
                                    shape = CircleShape,
                                    modifier = Modifier.size(8.dp),
                                ) {}
                                Text(agent.name, style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }

            HorizontalDivider()

            // Messages
            if (messages.isEmpty()) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Groups,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text("Start a crew conversation", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Use @AgentName to message specific agents",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                        )
                    }
                }
            } else {
                LazyColumn(
                    Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp),
                    reverseLayout = true,
                ) {
                    items(messages.reversed().size, key = { messages.reversed()[it].id }) { idx ->
                        val msg = messages.reversed()[idx]
                        CrewChatBubble(msg)
                    }
                }
            }

            HorizontalDivider()

            // Input
            Row(
                Modifier.padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { showMentionPicker = true }) {
                    Icon(Icons.Default.AlternateEmail, contentDescription = "Mention")
                }
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Message the crew...") },
                    singleLine = true,
                )
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = {
                        val text = inputText.trim()
                        if (text.isNotEmpty()) {
                            inputText = ""
                            val userMsg = CrewChatMessage(
                                id = java.util.UUID.randomUUID().toString(),
                                text = text,
                                isUser = true,
                            )
                            messages = messages + userMsg

                            // Parse @mentions
                            val mentionRegex = Regex("@(\\w+)")
                            val mentioned = mentionRegex.findAll(text).mapNotNull { match ->
                                val name = match.groupValues[1]
                                members.find { it.agent?.name == name }?.agentId
                            }.toList()

                            val targets = mentioned.ifEmpty { runningMembers.map { it.agentId } }

                            scope.launch {
                                val orgId = appState.currentOrganization.value?.id ?: return@launch
                                for (agentId in targets) {
                                    try {
                                        appState.apiClient.rpc(
                                            "assistants.chats.send",
                                            ChatSendInput(agentId, orgId, text),
                                            ChatSendInput.serializer(),
                                            ChatSendResponse.serializer()
                                        )
                                    } catch (_: Exception) { }
                                }
                            }
                        }
                    },
                    enabled = inputText.isNotBlank(),
                ) { Text("Send") }
            }
        }
    }

    // Mention picker dialog
    if (showMentionPicker) {
        AlertDialog(
            onDismissRequest = { showMentionPicker = false },
            title = { Text("Mention Agent") },
            text = {
                Column {
                    members.forEach { member ->
                        member.agent?.let { agent ->
                            ListItem(
                                headlineContent = { Text(agent.name) },
                                supportingContent = { Text(member.role) },
                                leadingContent = {
                                    Surface(
                                        color = when (agent.status) {
                                            AgentStatus.RUNNING -> Color(0xFF4CAF50)
                                            else -> Color.Gray
                                        },
                                        shape = CircleShape,
                                        modifier = Modifier.size(10.dp),
                                    ) {}
                                },
                                modifier = Modifier.let { mod ->
                                    mod
                                },
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showMentionPicker = false }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun CrewChatBubble(msg: CrewChatMessage) {
    val agentColors = listOf(
        Color(0xFF2196F3), Color(0xFF9C27B0), Color(0xFFFF9800),
        Color(0xFF009688), Color(0xFFE91E63), Color(0xFF3F51B5),
    )

    Row(
        Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = if (msg.isUser) Arrangement.End else Arrangement.Start,
    ) {
        Column(horizontalAlignment = if (msg.isUser) Alignment.End else Alignment.Start) {
            if (!msg.isUser && msg.agentName != null) {
                val colorIdx = kotlin.math.abs(msg.agentName.hashCode()) % agentColors.size
                Text(
                    msg.agentName,
                    style = MaterialTheme.typography.labelSmall,
                    color = agentColors[colorIdx],
                    modifier = Modifier.padding(bottom = 2.dp),
                )
            }
            Surface(
                color = if (msg.isUser) MaterialTheme.colorScheme.primaryContainer
                else MaterialTheme.colorScheme.surfaceVariant,
                shape = MaterialTheme.shapes.medium,
            ) {
                Text(
                    msg.text,
                    modifier = Modifier.padding(12.dp).widthIn(max = 280.dp),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}
