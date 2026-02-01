package bot.molt.android.onboarding

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

data class OnboardingStep(val icon: androidx.compose.ui.graphics.vector.ImageVector, val title: String, val description: String)

private val steps = listOf(
    OnboardingStep(Icons.Default.Shield, "Welcome to ThinkFleet", "Your AI agent management platform. Create, deploy, and manage intelligent agents from your mobile device."),
    OnboardingStep(Icons.Default.Memory, "Create Agents", "Set up AI agents with custom personas, connect them to messaging channels like WhatsApp, Telegram, and Discord."),
    OnboardingStep(Icons.Default.Checklist, "Manage Tasks", "Organize work with task boards, assign tasks to agents, and track progress in real time."),
    OnboardingStep(Icons.Default.Key, "Secure Credentials", "Securely store API keys for AI providers like Anthropic, OpenAI, and more. All encrypted at rest."),
)

@Composable
fun OnboardingScreen(onComplete: () -> Unit) {
    val pagerState = rememberPagerState(pageCount = { steps.size })
    val scope = rememberCoroutineScope()

    Column(Modifier.fillMaxSize()) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.weight(1f),
        ) { page ->
            val step = steps[page]
            Column(
                Modifier.fillMaxSize().padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(
                    step.icon,
                    contentDescription = null,
                    modifier = Modifier.size(72.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.height(24.dp))
                Text(step.title, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
                Spacer(Modifier.height(12.dp))
                Text(
                    step.description,
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // Page indicator
        Row(
            Modifier.fillMaxWidth().padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.Center,
        ) {
            repeat(steps.size) { index ->
                val color = if (index == pagerState.currentPage) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.surfaceVariant
                Surface(
                    modifier = Modifier.padding(4.dp).size(8.dp),
                    shape = MaterialTheme.shapes.small,
                    color = color,
                ) {}
            }
        }

        // Actions
        Column(Modifier.padding(horizontal = 24.dp, vertical = 32.dp)) {
            if (pagerState.currentPage == steps.size - 1) {
                Button(onClick = onComplete, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                    Text("Get Started")
                }
            } else {
                Button(
                    onClick = { scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) } },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    Text("Next")
                }
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = onComplete, modifier = Modifier.fillMaxWidth()) {
                    Text("Skip")
                }
            }
        }
    }
}
