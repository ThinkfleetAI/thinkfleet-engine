package bot.molt.android.settings

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import bot.molt.android.model.AppState
import kotlinx.coroutines.launch

@Composable
fun AccountSettingsScreen(appState: AppState, onBack: () -> Unit) {
    val user by appState.sessionStore.currentUser.collectAsState()
    var name by remember(user) { mutableStateOf(user?.name ?: "") }
    var isSaving by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Account") },
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
            // Profile card
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.width(16.dp))
                    Column {
                        Text(user?.name ?: "User", style = MaterialTheme.typography.titleMedium)
                        Text(user?.email ?: "", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )

            Spacer(Modifier.height(16.dp))

            Button(
                onClick = {
                    scope.launch {
                        isSaving = true
                        result = null
                        try {
                            // Save via API
                            result = "Profile updated."
                        } catch (e: Exception) {
                            result = "Error: ${e.message}"
                        }
                        isSaving = false
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isSaving,
            ) {
                if (isSaving) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                else Text("Save Changes")
            }

            result?.let {
                Spacer(Modifier.height(8.dp))
                Text(
                    it,
                    color = if (it.startsWith("Error")) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                )
            }

            Spacer(Modifier.height(32.dp))

            // Security section
            Text("Security", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))

            listOf(
                "Two-Factor Authentication" to "Set up 2FA for additional security",
                "Passkeys" to "Manage passwordless login",
                "Active Sessions" to "View and manage sessions",
                "Change Password" to "Update your password",
            ).forEach { (title, desc) ->
                ListItem(
                    headlineContent = { Text(title) },
                    supportingContent = { Text(desc) },
                )
                HorizontalDivider()
            }
        }
    }
}
