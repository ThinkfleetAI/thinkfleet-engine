import SwiftUI

struct PersonaListView: View {
    @Environment(AppState.self) private var appState
    @State private var personas: [Persona] = []
    @State private var isLoading = true
    @State private var showCreateSheet = false

    var body: some View {
        Group {
            if isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if personas.isEmpty {
                ContentUnavailableView(
                    "No Personas",
                    systemImage: "person.crop.rectangle.stack",
                    description: Text("Create personas to define agent behavior and personality.")
                )
            } else {
                List(personas) { persona in
                    NavigationLink(value: persona.id) {
                        PersonaRow(persona: persona)
                    }
                }
                .refreshable { await loadPersonas() }
            }
        }
        .navigationTitle("Personas")
        .navigationDestination(for: String.self) { personaId in
            PersonaDetailView(personaId: personaId)
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showCreateSheet = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            CreatePersonaSheet { await loadPersonas() }
        }
        .task { await loadPersonas() }
    }

    private func loadPersonas() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        struct Input: Codable { let organizationId: String }
        struct Response: Codable { let personas: [Persona] }
        if let response: Response = try? await appState.apiClient.rpc(
            "assistants.personas.list", input: Input(organizationId: orgId)
        ) {
            self.personas = response.personas
        }
        isLoading = false
    }
}

struct Persona: Codable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let systemPrompt: String?
    let model: String?
    let createdAt: String
    let updatedAt: String
}

struct PersonaRow: View {
    let persona: Persona

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(persona.name)
                .font(.body.weight(.medium))
            if let desc = persona.description {
                Text(desc)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            if let model = persona.model {
                Text(model)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.accentColor.opacity(0.1))
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, 4)
    }
}

struct PersonaDetailView: View {
    @Environment(AppState.self) private var appState
    let personaId: String
    @State private var persona: Persona?
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if let persona {
                List {
                    Section("Details") {
                        LabeledContent("Name", value: persona.name)
                        if let desc = persona.description {
                            LabeledContent("Description", value: desc)
                        }
                        if let model = persona.model {
                            LabeledContent("Model", value: model)
                        }
                        LabeledContent("Created", value: persona.createdAt)
                    }

                    if let prompt = persona.systemPrompt, !prompt.isEmpty {
                        Section("System Prompt") {
                            Text(prompt)
                                .font(.caption)
                                .textSelection(.enabled)
                        }
                    }

                    Section {
                        Text("Full persona editing is available in the web dashboard.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } else {
                ContentUnavailableView("Persona Not Found", systemImage: "exclamationmark.triangle")
            }
        }
        .navigationTitle(persona?.name ?? "Persona")
        .task { await loadPersona() }
    }

    private func loadPersona() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        struct Input: Codable { let personaId: String; let organizationId: String }
        struct Response: Codable { let persona: Persona }
        if let response: Response = try? await appState.apiClient.rpc(
            "assistants.personas.get", input: Input(personaId: personaId, organizationId: orgId)
        ) {
            self.persona = response.persona
        }
        isLoading = false
    }
}

struct CreatePersonaSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    let onCreated: () async -> Void

    @State private var name = ""
    @State private var description = ""
    @State private var systemPrompt = ""
    @State private var isCreating = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Basic Info") {
                    TextField("Name", text: $name)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }
                Section("System Prompt") {
                    TextEditor(text: $systemPrompt)
                        .frame(minHeight: 120)
                }
            }
            .navigationTitle("New Persona")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task { await createPersona() }
                    }
                    .disabled(name.isEmpty || isCreating)
                }
            }
        }
    }

    private func createPersona() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isCreating = true
        struct Input: Codable { let organizationId: String; let name: String; let description: String?; let systemPrompt: String? }
        struct Response: Codable { let persona: Persona }
        _ = try? await appState.apiClient.rpc(
            "assistants.personas.create",
            input: Input(organizationId: orgId, name: name, description: description.isEmpty ? nil : description, systemPrompt: systemPrompt.isEmpty ? nil : systemPrompt)
        ) as Response
        await onCreated()
        isCreating = false
        dismiss()
    }
}
