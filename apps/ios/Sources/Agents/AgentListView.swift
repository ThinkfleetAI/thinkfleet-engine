import SwiftUI

struct AgentListView: View {
    @Environment(AppState.self) private var appState
    @State private var showCreateAgent = false

    var body: some View {
        Group {
            if appState.isLoadingAgents && appState.agents.isEmpty {
                ProgressView("Loading agents...")
            } else if appState.agents.isEmpty {
                ContentUnavailableView {
                    Label("No Agents", systemImage: "cpu")
                } description: {
                    Text("Create your first agent to get started.")
                } actions: {
                    Button("Create Agent") {
                        showCreateAgent = true
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else {
                List {
                    Section("Agents") {
                        ForEach(appState.agents) { agent in
                            NavigationLink(value: agent.id) {
                                AgentRow(agent: agent)
                            }
                        }
                    }

                    if !appState.crews.isEmpty {
                        Section("Crews") {
                            ForEach(appState.crews) { crew in
                                NavigationLink(destination: CrewDetailView(crewId: crew.id)) {
                                    CrewRow(crew: crew)
                                }
                            }
                        }
                    }
                }
                .refreshable {
                    await appState.loadAgents()
                    await appState.loadCrews()
                }
            }
        }
        .navigationTitle("Agents")
        .navigationDestination(for: String.self) { agentId in
            AgentDetailView(agentId: agentId)
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showCreateAgent = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showCreateAgent) {
            CreateAgentSheet()
        }
    }
}

struct AgentRow: View {
    let agent: Agent

    var body: some View {
        HStack(spacing: 12) {
            AgentStatusIndicator(status: agent.status)

            VStack(alignment: .leading, spacing: 2) {
                Text(agent.name)
                    .font(.body.weight(.medium))
                Text(agent.status.rawValue.capitalized)
                    .font(.caption)
                    .foregroundStyle(statusColor)
            }

            Spacer()

            if let containerCount = agent.containers?.count, containerCount > 0 {
                Label("\(containerCount)", systemImage: "server.rack")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private var statusColor: Color {
        switch agent.status {
        case .RUNNING: .green
        case .STOPPED: .secondary
        case .PENDING: .yellow
        case .ERROR: .red
        case .TERMINATED: .secondary
        }
    }
}

struct AgentStatusIndicator: View {
    let status: AgentStatus

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 10, height: 10)
    }

    private var color: Color {
        switch status {
        case .RUNNING: .green
        case .STOPPED: .gray
        case .PENDING: .yellow
        case .ERROR: .red
        case .TERMINATED: .gray
        }
    }
}

// MARK: - Crew Row

struct CrewRow: View {
    let crew: Crew

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.3.fill")
                .foregroundStyle(statusColor)

            VStack(alignment: .leading, spacing: 2) {
                Text(crew.name)
                    .font(.body.weight(.medium))
                HStack(spacing: 6) {
                    Text(crew.status.rawValue.capitalized)
                        .font(.caption)
                        .foregroundStyle(statusColor)
                    if let count = crew.members?.count {
                        Text("\(count) members")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            if let lead = crew.leadAgent {
                Text(lead.name)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private var statusColor: Color {
        switch crew.status {
        case .active: .green
        case .paused: .yellow
        case .disbanded: .secondary
        }
    }
}

// MARK: - Create Agent

struct CreateAgentSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var isCreating = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Agent Name") {
                    TextField("My Agent", text: $name)
                }

                if let error = errorMessage {
                    Section {
                        Text(error).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("New Agent")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task { await createAgent() }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isCreating)
                }
            }
        }
    }

    private func createAgent() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isCreating = true
        errorMessage = nil

        let input = CreateAgentInput(
            organizationId: orgId,
            name: name.trimmingCharacters(in: .whitespaces),
            personaId: nil,
            podId: nil
        )

        do {
            let _: AgentResponse = try await appState.apiClient.rpc("assistants.agents.create", input: input)
            await appState.loadAgents()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }

        isCreating = false
    }
}
