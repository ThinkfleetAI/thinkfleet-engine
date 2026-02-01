import SwiftUI

struct AccountSettingsView: View {
    @Environment(AppState.self) private var appState
    @State private var name = ""
    @State private var email = ""
    @State private var isSaving = false
    @State private var saveResult: String?

    var body: some View {
        Form {
            Section("Profile") {
                HStack {
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    VStack(alignment: .leading) {
                        Text(appState.sessionStore.currentUser?.name ?? "User")
                            .font(.headline)
                        Text(appState.sessionStore.currentUser?.email ?? "")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 8)
            }

            Section("Edit Profile") {
                TextField("Name", text: $name)
                    .textContentType(.name)

                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
            }

            Section {
                Button {
                    Task { await saveProfile() }
                } label: {
                    if isSaving {
                        ProgressView()
                    } else {
                        Text("Save Changes")
                    }
                }
                .disabled(isSaving)
            }

            if let result = saveResult {
                Section {
                    Text(result)
                        .foregroundStyle(result.contains("Error") ? .red : .green)
                }
            }
        }
        .navigationTitle("Account")
        .onAppear {
            name = appState.sessionStore.currentUser?.name ?? ""
            email = appState.sessionStore.currentUser?.email ?? ""
        }
    }

    private func saveProfile() async {
        isSaving = true
        saveResult = nil

        struct Input: Codable { let name: String }
        struct Response: Codable { let success: Bool? }

        do {
            let _: Response = try await appState.apiClient.rpc(
                "users.updateProfile", input: Input(name: name)
            )
            saveResult = "Profile updated."
        } catch {
            saveResult = "Error: \(error.localizedDescription)"
        }
        isSaving = false
    }
}

struct SecuritySettingsView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        List {
            Section("Two-Factor Authentication") {
                NavigationLink {
                    TwoFactorSetupView()
                } label: {
                    Label("Set up 2FA", systemImage: "lock.shield")
                }
            }

            Section("Passkeys") {
                NavigationLink {
                    PasskeyListView()
                } label: {
                    Label("Manage Passkeys", systemImage: "person.badge.key")
                }
            }

            Section("Sessions") {
                NavigationLink {
                    ActiveSessionsView()
                } label: {
                    Label("Active Sessions", systemImage: "desktopcomputer")
                }
            }

            Section("Password") {
                NavigationLink {
                    ChangePasswordView()
                } label: {
                    Label("Change Password", systemImage: "key")
                }
            }
        }
        .navigationTitle("Security")
    }
}

// MARK: - Security Sub-Views (Stubs)

struct TwoFactorSetupView: View {
    var body: some View {
        ContentUnavailableView(
            "Two-Factor Authentication",
            systemImage: "lock.shield",
            description: Text("2FA setup will be available in a future update.")
        )
        .navigationTitle("2FA")
    }
}

struct PasskeyListView: View {
    var body: some View {
        ContentUnavailableView(
            "Passkeys",
            systemImage: "person.badge.key",
            description: Text("Passkey management will be available in a future update.")
        )
        .navigationTitle("Passkeys")
    }
}

struct ActiveSessionsView: View {
    var body: some View {
        ContentUnavailableView(
            "Active Sessions",
            systemImage: "desktopcomputer",
            description: Text("Session management will be available in a future update.")
        )
        .navigationTitle("Sessions")
    }
}

struct ChangePasswordView: View {
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""

    var body: some View {
        Form {
            Section {
                SecureField("Current Password", text: $currentPassword)
                SecureField("New Password", text: $newPassword)
                SecureField("Confirm New Password", text: $confirmPassword)
            }

            Section {
                Button("Update Password") {
                    // Call auth API
                }
                .disabled(newPassword.isEmpty || newPassword != confirmPassword)
            }
        }
        .navigationTitle("Change Password")
    }
}

struct BillingView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        List {
            Section("Current Plan") {
                LabeledContent("Plan", value: "Free")
                LabeledContent("Status", value: "Active")
            }

            Section {
                Button("Manage Subscription") {
                    // Open Stripe customer portal in SFSafariViewController
                }

                Button("Upgrade Plan") {
                    // Open plan selection
                }
            }
        }
        .navigationTitle("Billing")
    }
}
