package bot.molt.android.workflows

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import bot.molt.android.model.AppState
import kotlinx.serialization.Serializable

@Serializable
data class Workflow(
    val id: String,
    val name: String,
    val description: String? = null,
    val status: String? = null,
    val createdAt: String,
    val updatedAt: String,
)

@Composable
fun WorkflowListScreen(appState: AppState, onBack: (() -> Unit)? = null) {
    var workflows by remember { mutableStateOf<List<Workflow>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedWorkflow by remember { mutableStateOf<Workflow?>(null) }

    LaunchedEffect(appState.currentOrganization.value) {
        isLoading = true
        // Load workflows via API
        isLoading = false
    }

    if (selectedWorkflow != null) {
        WorkflowDetailScreen(appState, selectedWorkflow!!) { selectedWorkflow = null }
        return
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Workflows") }) }
    ) { padding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (workflows.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No Workflows", style = MaterialTheme.typography.headlineSmall)
                    Text("Create workflows in the web dashboard.", style = MaterialTheme.typography.bodyMedium)
                }
            }
        } else {
            LazyColumn(Modifier.padding(padding)) {
                items(workflows, key = { it.id }) { workflow ->
                    ListItem(
                        modifier = Modifier.clickable { selectedWorkflow = workflow },
                        headlineContent = { Text(workflow.name) },
                        supportingContent = { workflow.description?.let { Text(it, maxLines = 2) } },
                        trailingContent = {
                            workflow.status?.let {
                                AssistChip(onClick = {}, label = { Text(it.replaceFirstChar { c -> c.uppercase() }) })
                            }
                        }
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
fun WorkflowDetailScreen(appState: AppState, workflow: Workflow, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(workflow.name) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                }
            )
        }
    ) { padding ->
        Column(Modifier.padding(padding).padding(16.dp)) {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text("Details", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Text("Name: ${workflow.name}")
                    workflow.description?.let { Text("Description: $it") }
                    workflow.status?.let { Text("Status: ${it.replaceFirstChar { c -> c.uppercase() }}") }
                    Text("Created: ${workflow.createdAt}")
                }
            }

            Spacer(Modifier.height(16.dp))

            Button(
                onClick = { /* Execute workflow via API */ },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Run Workflow")
            }

            Spacer(Modifier.height(16.dp))

            Text(
                "Workflow editing is available in the web dashboard.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
