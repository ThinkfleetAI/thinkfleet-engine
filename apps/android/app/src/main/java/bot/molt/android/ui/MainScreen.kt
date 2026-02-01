package bot.molt.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Memory
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import bot.molt.android.agents.AgentListScreen
import bot.molt.android.model.AppState
import bot.molt.android.tasks.TaskBoardScreen
import kotlinx.coroutines.launch

enum class MainTab(val label: String) {
    Agents("Agents"),
    Tasks("Tasks"),
    Settings("Settings"),
}

@Composable
fun MainNavScreen(appState: AppState) {
    var selectedTab by remember { mutableStateOf(MainTab.Agents) }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == MainTab.Agents,
                    onClick = { selectedTab = MainTab.Agents },
                    icon = { Icon(Icons.Default.Memory, contentDescription = "Agents") },
                    label = { Text("Agents") },
                )
                NavigationBarItem(
                    selected = selectedTab == MainTab.Tasks,
                    onClick = { selectedTab = MainTab.Tasks },
                    icon = { Icon(Icons.Default.Checklist, contentDescription = "Tasks") },
                    label = { Text("Tasks") },
                )
                NavigationBarItem(
                    selected = selectedTab == MainTab.Settings,
                    onClick = { selectedTab = MainTab.Settings },
                    icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                    label = { Text("Settings") },
                )
            }
        }
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (selectedTab) {
                MainTab.Agents -> AgentListScreen(appState)
                MainTab.Tasks -> TaskBoardScreen(appState)
                MainTab.Settings -> SettingsScreen(appState)
            }
        }
    }
}

@Composable
fun PlaceholderScreen(title: String, message: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
        Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
            Text(title, style = MaterialTheme.typography.headlineSmall)
            Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

enum class SettingsDestination {
    Root, Account, OrgSettings, Credentials, Personas, Workflows
}

@Composable
fun SettingsScreen(appState: AppState) {
    var destination by remember { mutableStateOf(SettingsDestination.Root) }

    when (destination) {
        SettingsDestination.Root -> SettingsRootScreen(appState, onNavigate = { destination = it })
        SettingsDestination.Account -> bot.molt.android.settings.AccountSettingsScreen(appState) { destination = SettingsDestination.Root }
        SettingsDestination.OrgSettings -> bot.molt.android.organizations.OrgSettingsScreen(appState) { destination = SettingsDestination.Root }
        SettingsDestination.Credentials -> bot.molt.android.credentials.CredentialListScreen(appState) { destination = SettingsDestination.Root }
        SettingsDestination.Personas -> bot.molt.android.personas.PersonaListScreen(appState) { destination = SettingsDestination.Root }
        SettingsDestination.Workflows -> bot.molt.android.workflows.WorkflowListScreen(appState) { destination = SettingsDestination.Root }
    }
}

@Composable
private fun SettingsRootScreen(appState: AppState, onNavigate: (SettingsDestination) -> Unit) {
    val user by appState.sessionStore.currentUser.collectAsState()
    val currentOrg by appState.currentOrganization.collectAsState()
    val organizations by appState.organizations.collectAsState()
    val scope = rememberCoroutineScope()
    var showOrgPicker by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Settings", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(16.dp))

        user?.let {
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(16.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(40.dp), tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(it.name ?: "User", style = MaterialTheme.typography.titleMedium)
                        Text(it.email, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        Spacer(Modifier.height(24.dp))

        Text("Account", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
        ListItem(
            headlineContent = { Text("Account Settings") },
            modifier = Modifier.clickable { onNavigate(SettingsDestination.Account) },
        )
        HorizontalDivider()

        Spacer(Modifier.height(16.dp))

        Text("Organization", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
        currentOrg?.let { org ->
            ListItem(
                headlineContent = { Text(org.name) },
                supportingContent = { Text("Tap to switch organization") },
                modifier = Modifier.clickable { showOrgPicker = true },
            )
            HorizontalDivider()
        }
        ListItem(
            headlineContent = { Text("Members & Settings") },
            modifier = Modifier.clickable { onNavigate(SettingsDestination.OrgSettings) },
        )
        HorizontalDivider()
        ListItem(
            headlineContent = { Text("API Keys") },
            modifier = Modifier.clickable { onNavigate(SettingsDestination.Credentials) },
        )
        HorizontalDivider()
        ListItem(
            headlineContent = { Text("Personas") },
            modifier = Modifier.clickable { onNavigate(SettingsDestination.Personas) },
        )
        HorizontalDivider()
        ListItem(
            headlineContent = { Text("Workflows") },
            modifier = Modifier.clickable { onNavigate(SettingsDestination.Workflows) },
        )
        HorizontalDivider()

        Spacer(Modifier.weight(1f))

        OutlinedButton(
            onClick = { scope.launch { appState.signOut() } },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
        ) {
            Text("Sign Out")
        }
    }

    if (showOrgPicker) {
        AlertDialog(
            onDismissRequest = { showOrgPicker = false },
            title = { Text("Switch Organization") },
            text = {
                Column {
                    organizations.forEach { org ->
                        ListItem(
                            headlineContent = { Text(org.name) },
                            modifier = Modifier.clickable {
                                appState.selectOrganization(org)
                                scope.launch { appState.loadAgents() }
                                showOrgPicker = false
                            },
                            trailingContent = {
                                if (org.id == currentOrg?.id) {
                                    Icon(Icons.Default.Checklist, contentDescription = "Selected", tint = MaterialTheme.colorScheme.primary)
                                }
                            }
                        )
                    }
                }
            },
            confirmButton = { TextButton(onClick = { showOrgPicker = false }) { Text("Cancel") } },
        )
    }
}
