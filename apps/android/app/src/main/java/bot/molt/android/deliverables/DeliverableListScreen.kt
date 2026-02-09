package bot.molt.android.deliverables

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
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

@Composable
fun DeliverableListScreen(appState: AppState) {
    val agents by appState.agents.collectAsState()
    var tasks by remember { mutableStateOf<List<AgentTask>>(emptyList()) }
    var attachments by remember { mutableStateOf<List<TaskAttachment>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedAgentId by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val deliveredTasks = tasks
        .filter { it.status == TaskStatus.delivered || it.status == TaskStatus.done }
        .let { list ->
            if (selectedAgentId != null) list.filter { it.agentId == selectedAgentId }
            else list
        }

    suspend fun loadDeliverables() {
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

        val allAttachments = mutableListOf<TaskAttachment>()
        for (agent in agents) {
            try {
                val response = appState.apiClient.rpc(
                    "assistants.agents.attachments.list",
                    AttachmentListInput(agent.id, orgId),
                    AttachmentListInput.serializer(),
                    AttachmentListResponse.serializer()
                )
                allAttachments.addAll(response.attachments)
            } catch (_: Exception) { }
        }
        attachments = allAttachments

        isLoading = false
    }

    LaunchedEffect(appState.currentOrganization.value) {
        loadDeliverables()
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Deliverables") }) }
    ) { padding ->
        Column(Modifier.padding(padding)) {
            // Agent filter
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(vertical = 8.dp),
            ) {
                item {
                    FilterChip(
                        selected = selectedAgentId == null,
                        onClick = { selectedAgentId = null },
                        label = { Text("All") },
                    )
                }
                items(agents, key = { it.id }) { agent ->
                    FilterChip(
                        selected = selectedAgentId == agent.id,
                        onClick = { selectedAgentId = if (selectedAgentId == agent.id) null else agent.id },
                        label = { Text(agent.name) },
                    )
                }
            }

            HorizontalDivider()

            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (deliveredTasks.isEmpty() && attachments.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Inventory,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text("No Deliverables", style = MaterialTheme.typography.headlineSmall)
                        Text(
                            "Your agents haven't produced any deliverables yet.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            } else {
                var isRefreshing by remember { mutableStateOf(false) }
                PullToRefreshBox(
                    isRefreshing = isRefreshing,
                    onRefresh = {
                        isRefreshing = true
                        scope.launch {
                            loadDeliverables()
                            isRefreshing = false
                        }
                    },
                ) {
                    LazyColumn(Modifier.fillMaxSize()) {
                        if (deliveredTasks.isNotEmpty()) {
                            item {
                                Text(
                                    "Task Outputs",
                                    style = MaterialTheme.typography.titleSmall,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                                )
                            }
                            items(deliveredTasks, key = { it.id }) { task ->
                                DeliverableTaskRow(task)
                                HorizontalDivider()
                            }
                        }

                        if (attachments.isNotEmpty()) {
                            item {
                                Text(
                                    "File Attachments",
                                    style = MaterialTheme.typography.titleSmall,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                                )
                            }
                            items(attachments, key = { it.id }) { attachment ->
                                AttachmentRow(attachment)
                                HorizontalDivider()
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DeliverableTaskRow(task: AgentTask) {
    ListItem(
        headlineContent = { Text(task.title, maxLines = 2) },
        supportingContent = {
            Column {
                task.deliverables?.takeIf { it.isNotEmpty() }?.let {
                    Text(it, maxLines = 3, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val statusColor = if (task.status == TaskStatus.delivered) Color(0xFF2196F3) else Color(0xFF4CAF50)
                    val statusLabel = if (task.status == TaskStatus.delivered) "Delivered" else "Done"
                    Surface(
                        color = statusColor.copy(alpha = 0.15f),
                        shape = MaterialTheme.shapes.small,
                    ) {
                        Text(
                            statusLabel,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = statusColor,
                        )
                    }
                    task.urgency?.let { urgency ->
                        val (urgLabel, urgColor) = when (urgency) {
                            1 -> "Critical" to Color(0xFFF44336)
                            2 -> "High" to Color(0xFFFF9800)
                            3 -> "Medium" to Color(0xFFFFC107)
                            else -> "Low" to Color.Gray
                        }
                        Surface(
                            color = urgColor.copy(alpha = 0.15f),
                            shape = MaterialTheme.shapes.small,
                        ) {
                            Text(
                                urgLabel,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = urgColor,
                            )
                        }
                    }
                }
            }
        },
    )
}

@Composable
private fun AttachmentRow(attachment: TaskAttachment) {
    ListItem(
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
            Icon(Icons.Default.Download, contentDescription = "Download", tint = Color(0xFF2196F3))
        },
    )
}

private fun formatFileSize(bytes: Int): String {
    if (bytes < 1024) return "$bytes B"
    if (bytes < 1_048_576) return "%.1f KB".format(bytes / 1024.0)
    return "%.1f MB".format(bytes / 1_048_576.0)
}
