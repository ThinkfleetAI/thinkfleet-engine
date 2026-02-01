import SwiftUI

struct CredentialListView: View {
    @Environment(AppState.self) private var appState
    @State private var credentials: [CredentialInfo] = []
    @State private var isLoading = true
    @State private var showAddCredential = false

    private let categories: [(String, [String])] = [
        ("AI Model Providers", ["anthropic", "openai", "gemini", "groq", "mistral", "openrouter", "xai", "deepseek", "perplexity"]),
        ("Voice & TTS", ["elevenlabs", "deepgram"]),
        ("Search", ["brave"]),
        ("DevOps", ["github"]),
        ("Cloud", ["aws"]),
    ]

    var body: some View {
        List {
            if isLoading {
                Section {
                    ProgressView()
                }
            } else {
                ForEach(categories, id: \.0) { category, providers in
                    Section(category) {
                        ForEach(providers, id: \.self) { provider in
                            let cred = credentials.first { $0.provider == provider }
                            CredentialRow(
                                provider: provider,
                                isConfigured: cred?.hasValue == true,
                                onTap: { showAddCredential = true }
                            )
                        }
                    }
                }
            }
        }
        .navigationTitle("API Keys")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAddCredential = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddCredential) {
            AddCredentialSheet { await loadCredentials() }
        }
        .task { await loadCredentials() }
    }

    private func loadCredentials() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        struct Input: Codable { let organizationId: String }
        struct Response: Codable { let credentials: [CredentialInfo] }

        if let response: Response = try? await appState.apiClient.rpc(
            "assistants.orgCredentials.list", input: Input(organizationId: orgId)
        ) {
            self.credentials = response.credentials
        }
        isLoading = false
    }
}

struct CredentialRow: View {
    let provider: String
    let isConfigured: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                Image(systemName: providerIcon)
                    .frame(width: 24)
                    .foregroundStyle(.secondary)

                Text(providerDisplayName)
                    .foregroundStyle(.primary)

                Spacer()

                if isConfigured {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                } else {
                    Text("Not set")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var providerDisplayName: String {
        switch provider {
        case "anthropic": "Anthropic"
        case "openai": "OpenAI"
        case "gemini": "Google Gemini"
        case "groq": "Groq"
        case "mistral": "Mistral"
        case "openrouter": "OpenRouter"
        case "xai": "xAI"
        case "deepseek": "DeepSeek"
        case "perplexity": "Perplexity"
        case "elevenlabs": "ElevenLabs"
        case "deepgram": "Deepgram"
        case "brave": "Brave Search"
        case "github": "GitHub"
        case "aws": "AWS"
        default: provider.capitalized
        }
    }

    private var providerIcon: String {
        switch provider {
        case "anthropic", "openai", "gemini", "groq", "mistral", "openrouter", "xai", "deepseek", "perplexity":
            "brain"
        case "elevenlabs", "deepgram": "waveform"
        case "brave": "magnifyingglass"
        case "github": "chevron.left.forwardslash.chevron.right"
        case "aws": "cloud"
        default: "key"
        }
    }
}

struct AddCredentialSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var provider = "anthropic"
    @State private var apiKey = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    let onSaved: () async -> Void

    private let providers = [
        "anthropic", "openai", "gemini", "groq", "mistral",
        "openrouter", "xai", "deepseek", "perplexity",
        "elevenlabs", "deepgram", "brave", "github", "aws",
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Provider") {
                    Picker("Provider", selection: $provider) {
                        ForEach(providers, id: \.self) { p in
                            Text(p.capitalized).tag(p)
                        }
                    }
                }

                Section("API Key") {
                    SecureField("Enter API key", text: $apiKey)
                        .textContentType(.password)
                }

                if let error = errorMessage {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Add API Key")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(apiKey.isEmpty || isSaving)
                }
            }
        }
    }

    private func save() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isSaving = true
        errorMessage = nil

        struct Input: Codable { let organizationId: String; let provider: String; let value: String }
        struct Response: Codable { let id: String? }

        do {
            let _: Response = try await appState.apiClient.rpc(
                "assistants.orgCredentials.upsert",
                input: Input(organizationId: orgId, provider: provider, value: apiKey)
            )
            await onSaved()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}
