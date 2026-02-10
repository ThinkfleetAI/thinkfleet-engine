package bot.molt.android.organizations

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import bot.molt.android.model.AppState
import bot.molt.android.networking.Organization
import bot.molt.android.networking.OrganizationMember
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Composable
fun OrgSettingsScreen(appState: AppState, onBack: (() -> Unit)? = null) {
    val currentOrg by appState.currentOrganization.collectAsState()
    var members by remember { mutableStateOf<List<OrganizationMember>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var showInviteDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(currentOrg) {
        isLoading = true
        // Members loading would use the API client
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Organization") })
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showInviteDialog = true }) {
                Icon(Icons.Default.PersonAdd, contentDescription = "Invite")
            }
        }
    ) { padding ->
        LazyColumn(Modifier.padding(padding)) {
            currentOrg?.let { org ->
                item {
                    ListItem(
                        headlineContent = { Text(org.name) },
                        supportingContent = { Text(org.slug ?: "") },
                        overlineContent = { Text("Organization Name") },
                    )
                    HorizontalDivider()
                }

                if (org.isPersonal == true) {
                    item {
                        ListItem(
                            headlineContent = { Text("Personal Organization") },
                            supportingContent = { Text("This is your personal workspace.") },
                        )
                        HorizontalDivider()
                    }
                }
            }

            item {
                ListItem(
                    headlineContent = {
                        Text("Members", style = MaterialTheme.typography.titleMedium)
                    }
                )
            }

            if (isLoading) {
                item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
            } else if (members.isEmpty()) {
                item {
                    Text(
                        "No members loaded yet.",
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                items(members, key = { it.id }) { member ->
                    ListItem(
                        headlineContent = { Text(member.user?.name ?: member.user?.email ?: "Unknown") },
                        supportingContent = { member.user?.email?.let { Text(it) } },
                        trailingContent = {
                            AssistChip(
                                onClick = {},
                                label = { Text(member.role.replaceFirstChar { it.uppercase() }) },
                            )
                        }
                    )
                    HorizontalDivider()
                }
            }
        }
    }

    if (showInviteDialog) {
        InviteMemberDialog(
            onDismiss = { showInviteDialog = false },
            onInvite = { email, role ->
                scope.launch {
                    // Send invite via API
                    showInviteDialog = false
                }
            }
        )
    }
}

@Composable
private fun InviteMemberDialog(
    onDismiss: () -> Unit,
    onInvite: (String, String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("member") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Invite Member") },
        text = {
            Column {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Role: ", style = MaterialTheme.typography.bodyMedium)
                    FilterChip(
                        selected = role == "member",
                        onClick = { role = "member" },
                        label = { Text("Member") },
                    )
                    Spacer(Modifier.width(8.dp))
                    FilterChip(
                        selected = role == "admin",
                        onClick = { role = "admin" },
                        label = { Text("Admin") },
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onInvite(email, role) },
                enabled = email.isNotBlank(),
            ) { Text("Send Invite") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
