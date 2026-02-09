package bot.molt.android.crews

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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

@Composable
fun CrewDetailScreen(appState: AppState, crewId: String, onBack: () -> Unit, onChat: (Crew) -> Unit) {
    var crew by remember { mutableStateOf<Crew?>(null) }
    var executions by remember { mutableStateOf<List<CrewExecution>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(crewId) {
        isLoading = true
        val orgId = appState.currentOrganization.value?.id ?: return@LaunchedEffect
        try {
            val response = appState.apiClient.rpc(
                "assistants.crews.get",
                CrewIdInput(crewId, orgId),
                CrewIdInput.serializer(),
                CrewResponse.serializer()
            )
            crew = response.crew
        } catch (_: Exception) { }
        try {
            val execResponse = appState.apiClient.rpc(
                "assistants.crews.execution.list",
                CrewIdInput(crewId, orgId),
                CrewIdInput.serializer(),
                CrewExecutionListResponse.serializer()
            )
            executions = execResponse.executions
        } catch (_: Exception) { }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(crew?.name ?: "Crew") },
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
        if (isLoading && crew == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (crew == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("Crew not found", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            val c = crew!!
            LazyColumn(
                Modifier.padding(padding).fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // Status badge
                item {
                    CrewStatusChip(c.status)
                }

                // Description
                item {
                    c.description?.takeIf { it.isNotEmpty() }?.let {
                        Text(it, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }

                // Quick actions
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = { onChat(c) }, modifier = Modifier.weight(1f)) {
                            Icon(Icons.Default.ChatBubble, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Chat")
                        }
                        OutlinedButton(onClick = { }, modifier = Modifier.weight(1f)) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Execute")
                        }
                    }
                }

                // Members
                item {
                    Text("Members", style = MaterialTheme.typography.titleMedium)
                }
                val members = c.members ?: emptyList()
                if (members.isEmpty()) {
                    item {
                        Text("No members", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                } else {
                    items(members, key = { it.id }) { member ->
                        Row(
                            Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            member.agent?.let { agent ->
                                Surface(
                                    color = when (agent.status) {
                                        AgentStatus.RUNNING -> Color(0xFF4CAF50)
                                        AgentStatus.ERROR -> Color(0xFFF44336)
                                        else -> Color.Gray
                                    },
                                    shape = CircleShape,
                                    modifier = Modifier.size(10.dp),
                                ) {}
                                Column(Modifier.weight(1f)) {
                                    Text(agent.name, style = MaterialTheme.typography.bodyLarge)
                                    Text(member.role, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            } ?: run {
                                Surface(color = Color.Gray, shape = CircleShape, modifier = Modifier.size(10.dp)) {}
                                Text(member.role, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                            }
                            if (member.agentId == c.leadAgentId) {
                                Icon(Icons.Default.Star, contentDescription = "Lead", tint = Color(0xFFFFC107), modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }

                // Executions
                item {
                    Text("Recent Executions", style = MaterialTheme.typography.titleMedium)
                }
                if (executions.isEmpty()) {
                    item {
                        Text("No executions yet", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                } else {
                    items(executions.take(5), key = { it.id }) { execution ->
                        Row(
                            Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Icon(
                                when (execution.status) {
                                    "running" -> Icons.Default.Autorenew
                                    "completed" -> Icons.Default.CheckCircle
                                    "failed" -> Icons.Default.Error
                                    else -> Icons.Default.Circle
                                },
                                contentDescription = null,
                                tint = when (execution.status) {
                                    "running" -> Color(0xFF2196F3)
                                    "completed" -> Color(0xFF4CAF50)
                                    "failed" -> Color(0xFFF44336)
                                    else -> Color.Gray
                                },
                            )
                            Column(Modifier.weight(1f)) {
                                Text(
                                    execution.objective ?: "Untitled execution",
                                    style = MaterialTheme.typography.bodyMedium,
                                    maxLines = 1,
                                )
                                Text(
                                    execution.status.replaceFirstChar { it.uppercase() },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CrewStatusChip(status: CrewStatus) {
    val (label, color) = when (status) {
        CrewStatus.active -> "Active" to Color(0xFF4CAF50)
        CrewStatus.paused -> "Paused" to Color(0xFFFFC107)
        CrewStatus.disbanded -> "Disbanded" to Color.Gray
    }
    Surface(
        color = color.copy(alpha = 0.15f),
        shape = MaterialTheme.shapes.small,
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelMedium,
            color = color,
        )
    }
}
