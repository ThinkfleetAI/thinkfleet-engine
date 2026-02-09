package bot.molt.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import bot.molt.android.agents.AgentListScreen
import bot.molt.android.deliverables.DeliverableListScreen
import bot.molt.android.model.AppState
import bot.molt.android.settings.AccountSettingsScreen
import bot.molt.android.tasks.TaskBoardScreen
import kotlinx.coroutines.launch

enum class MainTab(val label: String) {
    Agents("Agents"),
    Chat("Chat"),
    Tasks("Tasks"),
    Deliverables("Deliverables"),
    Settings("Settings"),
}

@Composable
fun MainNavScreen(appState: AppState) {
    var selectedTab by remember { mutableStateOf(MainTab.Agents) }

    LaunchedEffect(Unit) {
        appState.onAuthenticated()
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                MainTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        icon = {
                            Icon(
                                when (tab) {
                                    MainTab.Agents -> Icons.Default.Memory
                                    MainTab.Chat -> Icons.Default.ChatBubble
                                    MainTab.Tasks -> Icons.Default.Checklist
                                    MainTab.Deliverables -> Icons.Default.Inventory
                                    MainTab.Settings -> Icons.Default.Settings
                                },
                                contentDescription = tab.label,
                            )
                        },
                        label = { Text(tab.label) },
                    )
                }
            }
        }
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (selectedTab) {
                MainTab.Agents -> AgentListScreen(appState)
                MainTab.Chat -> ChatRootScreen(appState)
                MainTab.Tasks -> TaskBoardScreen(appState)
                MainTab.Deliverables -> DeliverableListScreen(appState)
                MainTab.Settings -> SaaSSettingsScreen(appState)
            }
        }
    }
}

@Composable
fun SaaSSettingsScreen(appState: AppState) {
    val user by appState.sessionStore.currentUser.collectAsState()
    val currentOrg by appState.currentOrganization.collectAsState()
    val organizations by appState.organizations.collectAsState()
    val scope = rememberCoroutineScope()
    var showAccount by remember { mutableStateOf(false) }

    if (showAccount) {
        AccountSettingsScreen(appState) { showAccount = false }
        return
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Settings") }) }
    ) { padding ->
        Column(Modifier.padding(padding)) {
            ListItem(
                headlineContent = { Text(user?.name ?: "User") },
                supportingContent = { Text(user?.email ?: "") },
                leadingContent = { Icon(Icons.Default.Person, contentDescription = null) },
                modifier = Modifier.clickable { showAccount = true },
            )
            HorizontalDivider()

            if (organizations.size > 1) {
                Text(
                    "Organization",
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
                organizations.forEach { org ->
                    ListItem(
                        headlineContent = { Text(org.name) },
                        trailingContent = {
                            if (currentOrg?.id == org.id) {
                                Icon(Icons.Default.Check, contentDescription = "Selected")
                            }
                        },
                        modifier = Modifier.clickable {
                            appState.selectOrganization(org)
                            scope.launch {
                                appState.loadAgents()
                                appState.loadCrews()
                            }
                        },
                    )
                }
                HorizontalDivider()
            } else {
                currentOrg?.let { org ->
                    ListItem(
                        headlineContent = { Text("Organization") },
                        supportingContent = { Text(org.name) },
                        leadingContent = { Icon(Icons.Default.Business, contentDescription = null) },
                    )
                    HorizontalDivider()
                }
            }

            ListItem(
                headlineContent = { Text("Account Settings") },
                leadingContent = { Icon(Icons.Default.ManageAccounts, contentDescription = null) },
                modifier = Modifier.clickable { showAccount = true },
            )
            HorizontalDivider()

            ListItem(
                headlineContent = { Text("Sign Out", color = MaterialTheme.colorScheme.error) },
                leadingContent = {
                    Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                },
                modifier = Modifier.clickable {
                    scope.launch { appState.signOut() }
                },
            )
        }
    }
}
