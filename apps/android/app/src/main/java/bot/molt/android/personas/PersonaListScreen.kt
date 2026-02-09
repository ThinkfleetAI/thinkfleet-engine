package bot.molt.android.personas

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import bot.molt.android.model.AppState
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
data class Persona(
    val id: String,
    val name: String,
    val description: String? = null,
    val systemPrompt: String? = null,
    val model: String? = null,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
private data class PersonaListInput(val organizationId: String)

@Serializable
private data class PersonaListResponse(val personas: List<Persona>)

@Composable
fun PersonaListScreen(appState: AppState, onBack: () -> Unit) {
    var personas by remember { mutableStateOf<List<Persona>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedPersona by remember { mutableStateOf<Persona?>(null) }
    val scope = rememberCoroutineScope()

    if (selectedPersona != null) {
        PersonaDetailScreen(selectedPersona!!) { selectedPersona = null }
        return
    }

    LaunchedEffect(Unit) {
        isLoading = true
        try {
            val orgId = appState.currentOrganization.value?.id ?: return@LaunchedEffect
            val response = appState.apiClient.rpc(
                "assistants.personas.list",
                PersonaListInput(orgId),
                PersonaListInput.serializer(),
                PersonaListResponse.serializer()
            )
            personas = response.personas
        } catch (_: Exception) { }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Personas") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { /* create persona */ }) {
                Icon(Icons.Default.Add, contentDescription = "New Persona")
            }
        }
    ) { padding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else if (personas.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No Personas", style = MaterialTheme.typography.headlineSmall)
                    Text("Create personas to define agent behavior.", style = MaterialTheme.typography.bodyMedium)
                }
            }
        } else {
            LazyColumn(Modifier.padding(padding)) {
                items(personas, key = { it.id }) { persona ->
                    ListItem(
                        headlineContent = { Text(persona.name) },
                        supportingContent = { persona.description?.let { Text(it, maxLines = 2) } },
                        modifier = Modifier.clickable { selectedPersona = persona },
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun PersonaDetailScreen(persona: Persona, onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(persona.name) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        }
    ) { padding ->
        Column(Modifier.padding(padding).padding(16.dp)) {
            ListItem(headlineContent = { Text("Name") }, trailingContent = { Text(persona.name) })
            HorizontalDivider()
            persona.description?.let {
                ListItem(headlineContent = { Text("Description") }, supportingContent = { Text(it) })
                HorizontalDivider()
            }
            persona.model?.let {
                ListItem(headlineContent = { Text("Model") }, trailingContent = { Text(it) })
                HorizontalDivider()
            }
            persona.systemPrompt?.let {
                Spacer(Modifier.height(16.dp))
                Text("System Prompt", style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(8.dp))
                Text(it, style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(24.dp))
            Text(
                "Full persona editing is available in the web dashboard.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
