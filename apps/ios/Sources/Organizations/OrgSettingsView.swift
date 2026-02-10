import SwiftUI

struct OrgSettingsView: View {
    @Environment(AppState.self) private var appState
    @State private var members: [OrganizationMember] = []
    @State private var isLoading = true
    @State private var showInvite = false

    var body: some View {
        List {
            if let org = appState.currentOrganization {
                Section("Organization") {
                    LabeledContent("Name", value: org.name)
                    LabeledContent("Slug", value: org.slug ?? "")
                    if org.isPersonal == true {
                        Label("Personal Organization", systemImage: "person.fill")
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Section {
                if isLoading {
                    ProgressView()
                } else if members.isEmpty {
                    Text("No members found.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(members) { member in
                        MemberRow(member: member)
                    }
                }
            } header: {
                HStack {
                    Text("Members")
                    Spacer()
                    Button {
                        showInvite = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .navigationTitle("Organization")
        .sheet(isPresented: $showInvite) {
            InviteMemberSheet()
        }
        .task {
            await loadMembers()
        }
    }

    private func loadMembers() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true

        struct Input: Codable { let organizationId: String }
        struct Response: Codable { let members: [OrganizationMember] }

        if let response: Response = try? await appState.apiClient.rpc(
            "organizations.members.list", input: Input(organizationId: orgId)
        ) {
            self.members = response.members
        }
        isLoading = false
    }
}

struct MemberRow: View {
    let member: OrganizationMember

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.circle.fill")
                .font(.title2)
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 2) {
                Text(member.user?.name ?? member.user?.email ?? "Unknown")
                    .font(.body)
                if let email = member.user?.email {
                    Text(email)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            Text(member.role.capitalized)
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(member.role == "admin" ? Color.blue.opacity(0.1) : Color.secondary.opacity(0.1))
                .clipShape(Capsule())
        }
    }
}

struct InviteMemberSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var role = "member"
    @State private var isInviting = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Invite") {
                    TextField("Email address", text: $email)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    Picker("Role", selection: $role) {
                        Text("Member").tag("member")
                        Text("Admin").tag("admin")
                    }
                }

                if let error = errorMessage {
                    Section { Text(error).foregroundStyle(.red) }
                }
                if let success = successMessage {
                    Section { Text(success).foregroundStyle(.green) }
                }
            }
            .navigationTitle("Invite Member")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") {
                        Task { await invite() }
                    }
                    .disabled(email.isEmpty || isInviting)
                }
            }
        }
    }

    private func invite() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isInviting = true
        errorMessage = nil

        struct Input: Codable { let organizationId: String; let email: String; let role: String }
        struct Response: Codable { let id: String? }

        do {
            let _: Response = try await appState.apiClient.rpc(
                "organizations.invitations.create",
                input: Input(organizationId: orgId, email: email, role: role)
            )
            successMessage = "Invitation sent to \(email)"
            email = ""
        } catch {
            errorMessage = error.localizedDescription
        }
        isInviting = false
    }
}
