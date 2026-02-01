package bot.molt.android.credentials

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Key
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import bot.molt.android.model.AppState

data class CredentialCategory(val name: String, val providers: List<String>)

private val categories = listOf(
    CredentialCategory("AI Model Providers", listOf("anthropic", "openai", "gemini", "groq", "mistral", "openrouter", "xai", "deepseek", "perplexity")),
    CredentialCategory("Voice & TTS", listOf("elevenlabs", "deepgram")),
    CredentialCategory("Search", listOf("brave")),
    CredentialCategory("DevOps", listOf("github")),
    CredentialCategory("Cloud", listOf("aws")),
)

@Composable
fun CredentialListScreen(appState: AppState, onBack: (() -> Unit)? = null) {
    var configuredProviders by remember { mutableStateOf<Set<String>>(emptySet()) }
    var showAddDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("API Keys") }) },
    ) { padding ->
        LazyColumn(Modifier.padding(padding)) {
            categories.forEach { category ->
                item {
                    Text(
                        category.name,
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        color = MaterialTheme.colorScheme.primary,
                    )
                }

                items(category.providers) { provider ->
                    val isConfigured = provider in configuredProviders
                    ListItem(
                        headlineContent = { Text(providerDisplayName(provider)) },
                        leadingContent = {
                            Icon(Icons.Default.Key, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        },
                        trailingContent = {
                            if (isConfigured) {
                                Icon(Icons.Default.Check, contentDescription = "Configured", tint = MaterialTheme.colorScheme.primary)
                            } else {
                                Text("Not set", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        },
                        modifier = Modifier.padding(0.dp),
                    )
                    HorizontalDivider()
                }
            }
        }
    }

    if (showAddDialog) {
        // Add credential dialog
    }
}

private fun providerDisplayName(provider: String): String = when (provider) {
    "anthropic" -> "Anthropic"
    "openai" -> "OpenAI"
    "gemini" -> "Google Gemini"
    "groq" -> "Groq"
    "mistral" -> "Mistral"
    "openrouter" -> "OpenRouter"
    "xai" -> "xAI"
    "deepseek" -> "DeepSeek"
    "perplexity" -> "Perplexity"
    "elevenlabs" -> "ElevenLabs"
    "deepgram" -> "Deepgram"
    "brave" -> "Brave Search"
    "github" -> "GitHub"
    "aws" -> "AWS"
    else -> provider.replaceFirstChar { it.uppercase() }
}
