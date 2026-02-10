package bot.molt.android.integrations

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import bot.molt.android.model.AppState
import bot.molt.android.networking.*
import kotlinx.coroutines.launch

@Composable
fun IntegrationListScreen(appState: AppState, onBack: () -> Unit) {
    var connections by remember { mutableStateOf<List<ComposioConnection>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var showMarketplace by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun loadConnections() {
        val orgId = appState.currentOrganization.value?.id ?: return
        isLoading = true
        try {
            val response = appState.apiClient.rpc(
                "assistants.composio.connections",
                ComposioConnectionsInput(orgId),
                ComposioConnectionsInput.serializer(),
                ComposioConnectionsResponse.serializer()
            )
            connections = response.connections
        } catch (_: Exception) { }
        isLoading = false
    }

    LaunchedEffect(Unit) { loadConnections() }

    if (showMarketplace) {
        IntegrationMarketplaceScreen(appState, onBack = {
            showMarketplace = false
            scope.launch { loadConnections() }
        })
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Integrations") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showMarketplace = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Add integration")
                    }
                },
            )
        }
    ) { padding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (connections.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.Extension, contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text("No integrations yet", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(16.dp))
                    Button(onClick = { showMarketplace = true }) {
                        Text("Browse Marketplace")
                    }
                }
            }
        } else {
            LazyColumn(Modifier.padding(padding)) {
                items(connections, key = { it.id }) { conn ->
                    ListItem(
                        headlineContent = { Text(conn.appName) },
                        supportingContent = { Text(conn.status.replaceFirstChar { it.uppercase() }) },
                        leadingContent = {
                            Icon(
                                Icons.Default.Extension,
                                contentDescription = null,
                                tint = if (conn.status == "active") androidx.compose.ui.graphics.Color(0xFF4CAF50) else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        },
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
fun IntegrationMarketplaceScreen(appState: AppState, onBack: () -> Unit) {
    var apps by remember { mutableStateOf<List<ComposioApp>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var connectingApp by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val filtered = if (searchQuery.isBlank()) apps else {
        val q = searchQuery.lowercase()
        apps.filter { it.name.lowercase().contains(q) || (it.displayName?.lowercase()?.contains(q) == true) }
    }

    LaunchedEffect(Unit) {
        val orgId = appState.currentOrganization.value?.id ?: return@LaunchedEffect
        try {
            val response = appState.apiClient.rpc(
                "assistants.composio.apps",
                ComposioAppsInput(orgId, oauthOnly = true),
                ComposioAppsInput.serializer(),
                ComposioAppsResponse.serializer()
            )
            apps = response.apps
        } catch (_: Exception) { }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Add Integration") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        }
    ) { padding ->
        Column(Modifier.padding(padding)) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Search apps...") },
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            )

            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                LazyColumn {
                    items(filtered, key = { it.id }) { app ->
                        ListItem(
                            headlineContent = { Text(app.displayName ?: app.name) },
                            supportingContent = {
                                app.categories?.takeIf { it.isNotEmpty() }?.let {
                                    Text(it.joinToString(", "))
                                }
                            },
                            leadingContent = {
                                Icon(Icons.Default.Apps, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            },
                            trailingContent = {
                                if (connectingApp == app.name) {
                                    CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                                } else {
                                    Icon(Icons.Default.ChevronRight, contentDescription = null)
                                }
                            },
                            modifier = Modifier.clickable(enabled = connectingApp == null) {
                                connectingApp = app.name
                                scope.launch {
                                    val orgId = appState.currentOrganization.value?.id ?: return@launch
                                    try {
                                        val response = appState.apiClient.rpc(
                                            "assistants.composio.connect",
                                            ComposioConnectInput(orgId, app.name),
                                            ComposioConnectInput.serializer(),
                                            ComposioConnectResponse.serializer()
                                        )
                                        response.redirectUrl?.let { url ->
                                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                        }
                                    } catch (_: Exception) { }
                                    connectingApp = null
                                }
                            },
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}
