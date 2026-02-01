package bot.molt.android.tasks

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import bot.molt.android.model.AppState
import bot.molt.android.networking.AgentTask
import bot.molt.android.networking.TaskStatus

@Composable
fun TaskBoardScreen(appState: AppState) {
    var tasks by remember { mutableStateOf<List<AgentTask>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedFilter by remember { mutableStateOf<TaskStatus?>(null) }
    val scope = rememberCoroutineScope()

    val filteredTasks = if (selectedFilter == null) tasks
        else tasks.filter { it.status == selectedFilter }

    LaunchedEffect(appState.currentOrganization.value) {
        isLoading = true
        // Load tasks via API
        isLoading = false
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Tasks") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { /* Create task */ }) {
                Icon(Icons.Default.Add, contentDescription = "New Task")
            }
        }
    ) { padding ->
        Column(Modifier.padding(padding)) {
            // Filter chips
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(vertical = 8.dp),
            ) {
                item {
                    FilterChip(
                        selected = selectedFilter == null,
                        onClick = { selectedFilter = null },
                        label = { Text("All") },
                    )
                }
                items(listOf(TaskStatus.todo, TaskStatus.in_progress, TaskStatus.done)) { status ->
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
                        Text("No Tasks", style = MaterialTheme.typography.headlineSmall)
                        Text("Create a task to get started.")
                    }
                }
            } else {
                LazyColumn {
                    items(filteredTasks, key = { it.id }) { task ->
                        TaskRow(task)
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}

@Composable
private fun TaskRow(task: AgentTask) {
    ListItem(
        headlineContent = { Text(task.title, maxLines = 2) },
        supportingContent = {
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
            }
        },
        leadingContent = {
            Icon(
                when (task.status) {
                    TaskStatus.todo -> Icons.Default.Add // placeholder
                    TaskStatus.in_progress -> Icons.Default.Add
                    TaskStatus.done -> Icons.Default.Add
                    TaskStatus.archived -> Icons.Default.Add
                },
                contentDescription = null,
                tint = task.status.color(),
            )
        }
    )
}

private fun TaskStatus.displayName(): String = when (this) {
    TaskStatus.todo -> "To Do"
    TaskStatus.in_progress -> "In Progress"
    TaskStatus.done -> "Done"
    TaskStatus.archived -> "Archived"
}

private fun TaskStatus.color(): Color = when (this) {
    TaskStatus.todo -> Color.Gray
    TaskStatus.in_progress -> Color(0xFF2196F3)
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
