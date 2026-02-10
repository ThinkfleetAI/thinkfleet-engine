import SwiftUI

struct AuthGateView<Content: View>: View {
    @Environment(AppState.self) private var appState
    let content: () -> Content
    @State private var isRestoring = true

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        Group {
            if isRestoring {
                ProgressView("Restoring session…")
            } else if appState.isAuthenticated {
                content()
            } else {
                LoginView()
            }
        }
        .task {
            await appState.restoreSessionIfNeeded()
            isRestoring = false
        }
    }
}

struct LoginView: View {
    @Environment(AppState.self) private var appState

    @State private var email = ""
    @State private var password = ""
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
                        Image("AppLogo")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 80, height: 80)
                        Text("ThinkFleet")
                            .font(.largeTitle.bold())
                        Text(isForgotPassword ? "Reset your password" : "Sign in to continue")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 40)

                    // Form
                    VStack(spacing: 16) {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .textFieldStyle(.roundedBorder)

                        if !isForgotPassword {
                            SecureField("Password", text: $password)
                                .textContentType(.password)
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
                            Link("Don't have an account? Sign up", destination: URL(string: "https://www.thinkfleet.ai/auth/signup")!)
                                .font(.subheadline)
                        }

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
            .navigationBarHidden(true)
        }
    }

    private var primaryButtonLabel: String {
        isForgotPassword ? "Send Reset Link" : "Sign In"
    }

    private var isFormValid: Bool {
        if isForgotPassword { return !email.isEmpty }
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
            } else {
                let (signedToken, rawToken, user) = try await appState.authService.signInWithEmail(
                    email: email, password: password
                )
                await appState.handleLoginSuccess(signedToken: signedToken, rawToken: rawToken, user: user)
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}
