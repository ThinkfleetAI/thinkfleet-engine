package bot.molt.android.auth

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import com.thinkfleet.android.R
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import bot.molt.android.model.AppState
import kotlinx.coroutines.launch

@Composable
fun AuthScreen(appState: AppState, onAuthenticated: () -> Unit) {
    val context = LocalContext.current
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isForgotPassword by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(48.dp))

        Image(
            painter = painterResource(R.drawable.app_logo),
            contentDescription = "ThinkFleet",
            modifier = Modifier.size(80.dp),
        )
        Spacer(Modifier.height(12.dp))
        Text("ThinkFleet", style = MaterialTheme.typography.headlineLarge)
        Text(
            if (isForgotPassword) "Reset your password" else "Sign in to continue",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(Modifier.height(32.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
        )
        Spacer(Modifier.height(12.dp))

        if (!isForgotPassword) {
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            )
            Spacer(Modifier.height(16.dp))
        }

        errorMessage?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(8.dp))
        }

        successMessage?.let {
            Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(8.dp))
        }

        Button(
            onClick = {
                scope.launch {
                    isLoading = true
                    errorMessage = null
                    successMessage = null
                    try {
                        if (isForgotPassword) {
                            appState.authService.forgotPassword(email)
                            successMessage = "Check your email for a reset link."
                        } else {
                            val tokens = appState.authService.signInWithEmail(email, password)
                            appState.sessionStore.setSession(tokens.signedToken, rawToken = tokens.rawToken, user = tokens.user)
                            appState.onAuthenticated()
                            onAuthenticated()
                        }
                    } catch (e: Exception) {
                        errorMessage = e.message ?: "An error occurred."
                    }
                    isLoading = false
                }
            },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            enabled = !isLoading && email.isNotBlank() && (isForgotPassword || password.isNotBlank()),
        ) {
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            } else {
                Text(if (isForgotPassword) "Send Reset Link" else "Sign In")
            }
        }

        Spacer(Modifier.height(16.dp))

        if (!isForgotPassword) {
            TextButton(onClick = {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.thinkfleet.ai/auth/signup")))
            }) {
                Text("Don't have an account? Sign up")
            }
        }

        TextButton(onClick = {
            isForgotPassword = !isForgotPassword
            errorMessage = null
            successMessage = null
        }) {
            Text(if (isForgotPassword) "Back to sign in" else "Forgot password?")
        }
    }
}
