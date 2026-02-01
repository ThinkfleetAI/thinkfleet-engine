import SwiftUI

struct AuthGateView<Content: View>: View {
    @Environment(AppState.self) private var appState
    let content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        if appState.sessionStore.isAuthenticated {
            content()
        } else {
            LoginView()
        }
    }
}

struct LoginView: View {
    @Environment(AppState.self) private var appState

    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var isSignUp = false
    @State private var isForgotPassword = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Logo area
                    VStack(spacing: 8) {
                        Image(systemName: "bolt.shield.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(.tint)
                        Text("ThinkFleet")
                            .font(.largeTitle.bold())
                        Text(isSignUp ? "Create your account" : isForgotPassword ? "Reset your password" : "Sign in to continue")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 40)

                    // Form
                    VStack(spacing: 16) {
                        if isSignUp {
                            TextField("Name", text: $name)
                                .textContentType(.name)
                                .textFieldStyle(.roundedBorder)
                        }

                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .textFieldStyle(.roundedBorder)

                        if !isForgotPassword {
                            SecureField("Password", text: $password)
                                .textContentType(isSignUp ? .newPassword : .password)
                                .textFieldStyle(.roundedBorder)
                        }
                    }
                    .padding(.horizontal)

                    if let error = errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }

                    if let success = successMessage {
                        Text(success)
                            .font(.caption)
                            .foregroundStyle(.green)
                    }

                    // Primary action
                    Button {
                        Task { await performAction() }
                    } label: {
                        if isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text(primaryButtonLabel)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(isLoading || !isFormValid)
                    .padding(.horizontal)

                    // Secondary actions
                    VStack(spacing: 12) {
                        if !isForgotPassword {
                            Button(isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up") {
                                withAnimation {
                                    isSignUp.toggle()
                                    errorMessage = nil
                                    successMessage = nil
                                }
                            }
                            .font(.subheadline)
                        }

                        if !isSignUp {
                            Button(isForgotPassword ? "Back to sign in" : "Forgot password?") {
                                withAnimation {
                                    isForgotPassword.toggle()
                                    errorMessage = nil
                                    successMessage = nil
                                }
                            }
                            .font(.subheadline)
                        }
                    }
                }
            }
            .navigationBarHidden(true)
        }
    }

    private var primaryButtonLabel: String {
        if isForgotPassword { return "Send Reset Link" }
        return isSignUp ? "Sign Up" : "Sign In"
    }

    private var isFormValid: Bool {
        if isForgotPassword { return !email.isEmpty }
        if isSignUp { return !name.isEmpty && !email.isEmpty && !password.isEmpty }
        return !email.isEmpty && !password.isEmpty
    }

    private func performAction() async {
        isLoading = true
        errorMessage = nil
        successMessage = nil

        do {
            if isForgotPassword {
                try await appState.authService.forgotPassword(email: email)
                successMessage = "Check your email for a reset link."
            } else if isSignUp {
                let result = try await appState.authService.signUpWithEmail(
                    name: name, email: email, password: password
                )
                switch result {
                case .authenticated(let token, let user):
                    appState.sessionStore.setSession(token: token, user: user)
                case .emailVerificationRequired:
                    successMessage = "Account created! Check your email to verify, then sign in."
                    isSignUp = false
                }
            } else {
                let (token, user) = try await appState.authService.signInWithEmail(
                    email: email, password: password
                )
                appState.sessionStore.setSession(token: token, user: user)
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}
