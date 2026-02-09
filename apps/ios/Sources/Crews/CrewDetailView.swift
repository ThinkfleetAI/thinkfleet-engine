import SwiftUI

struct CrewDetailView: View {
    @Environment(AppState.self) private var appState
    let crewId: String
    @State private var crew: Crew?
    @State private var executions: [CrewExecution] = []
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading && crew == nil {
                ProgressView("Loading crew...")
            } else if let crew {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        headerSection(crew)
                        quickActions(crew)
                        membersSection(crew)
                        executionsSection
                    }
                    .padding()
                }
                .refreshable { await loadCrew() }
            } else {
                ContentUnavailableView("Crew Not Found", systemImage: "person.3")
            }
        }
        .navigationTitle(crew?.name ?? "Crew")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadCrew() }
    }

    @ViewBuilder
    private func headerSection(_ crew: Crew) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                CrewStatusBadge(status: crew.status)
                Spacer()
                if let lead = crew.leadAgent {
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .font(.caption)
                            .foregroundStyle(.yellow)
                        Text(lead.name)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if let desc = crew.description, !desc.isEmpty {
                Text(desc)
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func quickActions(_ crew: Crew) -> some View {
        HStack(spacing: 12) {
            NavigationLink(destination: CrewChatView(crew: crew)) {
                Label("Chat", systemImage: "bubble.left.and.bubble.right")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)

            Button {
                // Start execution - will be wired in Phase 5
            } label: {
                Label("Execute", systemImage: "play.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
    }

    @ViewBuilder
    private func membersSection(_ crew: Crew) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Members")
                .font(.headline)

            if let members = crew.members, !members.isEmpty {
                ForEach(members) { member in
                    HStack(spacing: 12) {
                        if let agent = member.agent {
                            AgentStatusIndicator(status: agent.status)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(agent.name)
                                    .font(.body.weight(.medium))
                                Text(member.role)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } else {
                            Circle()
                                .fill(.gray)
                                .frame(width: 10, height: 10)
                            Text(member.role)
                                .font(.body)
                        }
                        Spacer()
                        if member.agentId == crew.leadAgentId {
                            Image(systemName: "star.fill")
                                .font(.caption)
                                .foregroundStyle(.yellow)
                        }
                    }
                    .padding(.vertical, 4)
                }
            } else {
                Text("No members")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var executionsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recent Executions")
                .font(.headline)

            if executions.isEmpty {
                Text("No executions yet")
                    .font(.body)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(executions.prefix(5)) { execution in
                    HStack {
                        Image(systemName: executionIcon(execution.status))
                            .foregroundStyle(executionColor(execution.status))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(execution.objective ?? "Untitled execution")
                                .font(.body)
                                .lineLimit(1)
                            Text(execution.status.capitalized)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    private func loadCrew() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true

        let input = CrewIdInput(crewId: crewId, organizationId: orgId)
        if let response: CrewResponse = try? await appState.apiClient.rpc("assistants.crews.get", input: input) {
            crew = response.crew
        }

        if let execResponse: CrewExecutionListResponse = try? await appState.apiClient.rpc(
            "assistants.crews.execution.list", input: input
        ) {
            executions = execResponse.executions
        }

        isLoading = false
    }

    private func executionIcon(_ status: String) -> String {
        switch status {
        case "running": "circle.dotted.circle"
        case "completed": "checkmark.circle.fill"
        case "failed": "xmark.circle.fill"
        default: "circle"
        }
    }

    private func executionColor(_ status: String) -> Color {
        switch status {
        case "running": .blue
        case "completed": .green
        case "failed": .red
        default: .secondary
        }
    }
}

struct CrewStatusBadge: View {
    let status: CrewStatus

    var body: some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    private var label: String {
        switch status {
        case .active: "Active"
        case .paused: "Paused"
        case .disbanded: "Disbanded"
        }
    }

    private var color: Color {
        switch status {
        case .active: .green
        case .paused: .yellow
        case .disbanded: .secondary
        }
    }
}
