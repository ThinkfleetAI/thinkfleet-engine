package bot.molt.android.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
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
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var isSignUp by remember { mutableStateOf(false) }
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

        Icon(
            Icons.Default.Shield,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.height(12.dp))
        Text("ThinkFleet", style = MaterialTheme.typography.headlineLarge)
        Text(
            when {
                isSignUp -> "Create your account"
                isForgotPassword -> "Reset your password"
                else -> "Sign in to continue"
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(Modifier.height(32.dp))

        if (isSignUp) {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Spacer(Modifier.height(12.dp))
        }

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
                        when {
                            isForgotPassword -> {
                                appState.authService.forgotPassword(email)
                                successMessage = "Check your email for a reset link."
                            }
                            isSignUp -> {
                                val (token, user) = appState.authService.signUpWithEmail(name, email, password)
                                appState.sessionStore.setSession(token, user)
                                appState.onAuthenticated()
                                onAuthenticated()
                            }
                            else -> {
                                val (token, user) = appState.authService.signInWithEmail(email, password)
                                appState.sessionStore.setSession(token, user)
                                appState.onAuthenticated()
                                onAuthenticated()
                            }
                        }
                    } catch (e: Exception) {
                        errorMessage = e.message ?: "An error occurred."
                    }
                    isLoading = false
                }
            },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            enabled = !isLoading && email.isNotBlank() && (isForgotPassword || password.isNotBlank()) && (!isSignUp || name.isNotBlank()),
        ) {
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            } else {
                Text(
                    when {
                        isForgotPassword -> "Send Reset Link"
                        isSignUp -> "Sign Up"
                        else -> "Sign In"
                    }
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        if (!isForgotPassword) {
            TextButton(onClick = {
                isSignUp = !isSignUp
                errorMessage = null
                successMessage = null
            }) {
                Text(if (isSignUp) "Already have an account? Sign in" else "Don't have an account? Sign up")
            }
        }

        if (!isSignUp) {
            TextButton(onClick = {
                isForgotPassword = !isForgotPassword
                errorMessage = null
                successMessage = null
            }) {
                Text(if (isForgotPassword) "Back to sign in" else "Forgot password?")
            }
        }
    }
}
