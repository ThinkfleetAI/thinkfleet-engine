import SwiftUI

struct AgentDetailView: View {
    @Environment(AppState.self) private var appState
    let agentId: String

    @State private var agent: Agent?
    @State private var selectedTab = AgentTab.chat
    @State private var isLoading = true
    @State private var actionError: String?

    enum AgentTab: String, CaseIterable {
        case chat = "Chat"
        case overview = "Overview"
        case tasks = "Tasks"
        case documents = "Docs"
        case channels = "Channels"
        case logs = "Logs"
        case config = "Config"
    }

    var body: some View {
        VStack(spacing: 0) {
            if isLoading && agent == nil {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let agent {
                // Agent header
                agentHeader(agent)

                // Tab picker
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 0) {
                        ForEach(AgentTab.allCases, id: \.self) { tab in
                            Button {
                                selectedTab = tab
                            } label: {
                                Text(tab.rawValue)
                                    .font(.subheadline.weight(selectedTab == tab ? .semibold : .regular))
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 10)
                                    .background(selectedTab == tab ? Color.accentColor.opacity(0.1) : .clear)
                                    .clipShape(Capsule())
                            }
                            .foregroundStyle(selectedTab == tab ? .primary : .secondary)
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical, 4)

                Divider()

                // Tab content
                tabContent(agent)
            } else {
                ContentUnavailableView("Agent Not Found", systemImage: "exclamationmark.triangle")
            }
        }
        .navigationTitle(agent?.name ?? "Agent")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let agent {
                ToolbarItem(placement: .primaryAction) {
                    agentActionMenu(agent)
                }
            }
        }
        .task {
            await loadAgent()
        }
    }

    // MARK: - Header

    @ViewBuilder
    private func agentHeader(_ agent: Agent) -> some View {
        HStack(spacing: 12) {
            AgentStatusIndicator(status: agent.status)
            VStack(alignment: .leading, spacing: 2) {
                Text(agent.name)
                    .font(.headline)
                Text(agent.status.rawValue.capitalized)
                    .font(.caption)
                    .foregroundStyle(statusColor(agent.status))
            }
            Spacer()
        }
        .padding()

        if let error = actionError {
            Text(error)
                .font(.caption)
                .foregroundStyle(.red)
                .padding(.horizontal)
        }
    }

    // MARK: - Tab Content

    @ViewBuilder
    private func tabContent(_ agent: Agent) -> some View {
        switch selectedTab {
        case .chat:
            AgentChatView(agent: agent)
        case .overview:
            AgentOverviewTab(agent: agent)
        case .tasks:
            AgentTasksTab(agentId: agent.id)
        case .documents:
            DocumentListView(agentId: agent.id)
        case .channels:
            AgentChannelsTab(agent: agent)
        case .logs:
            AgentLogsTab(agentId: agent.id)
        case .config:
            AgentConfigTab(agent: agent)
        }
    }

    // MARK: - Actions

    private func agentActionMenu(_ agent: Agent) -> some View {
        Menu {
            if agent.status == .STOPPED || agent.status == .ERROR {
                Button {
                    Task {
                        actionError = nil
                        do { try await appState.startAgent(agent.id); await loadAgent() }
                        catch { actionError = error.localizedDescription }
                    }
                } label: {
                    Label("Start", systemImage: "play.fill")
                }
            }
            if agent.status == .RUNNING {
                Button {
                    Task {
                        actionError = nil
                        do { try await appState.stopAgent(agent.id); await loadAgent() }
                        catch { actionError = error.localizedDescription }
                    }
                } label: {
                    Label("Stop", systemImage: "stop.fill")
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
    }

    // MARK: - Data

    private func loadAgent() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        let input = AgentIdInput(id: agentId, organizationId: orgId)
        if let response: AgentResponse = try? await appState.apiClient.rpc("assistants.agents.get", input: input) {
            self.agent = response.agent
        }
        isLoading = false
    }

    private func statusColor(_ status: AgentStatus) -> Color {
        switch status {
        case .RUNNING: .green
        case .STOPPED: .secondary
        case .PENDING: .yellow
        case .ERROR: .red
        case .TERMINATED: .secondary
        }
    }
}

// MARK: - Tab Stubs

struct AgentOverviewTab: View {
    let agent: Agent

    var body: some View {
        List {
            Section("Status") {
                LabeledContent("Status", value: agent.status.rawValue.capitalized)
                LabeledContent("Created", value: agent.createdAt)
                if let containers = agent.containers {
                    LabeledContent("Instances", value: "\(containers.count)")
                }
                if let channels = agent.channels {
                    LabeledContent("Channels", value: "\(channels.count)")
                }
            }
        }
    }
}

struct AgentTasksTab: View {
    @Environment(AppState.self) private var appState
    let agentId: String
    @State private var tasks: [AgentTask] = []
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if tasks.isEmpty {
                ContentUnavailableView("No Tasks", systemImage: "checklist", description: Text("No tasks assigned to this agent."))
            } else {
                List(tasks) { task in
                    TaskRow(task: task, agents: appState.agents)
                }
                .refreshable { await loadTasks() }
            }
        }
        .task { await loadTasks() }
    }

    private func loadTasks() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        struct Input: Codable { let agentId: String; let organizationId: String }
        if let response: TaskListResponse = try? await appState.apiClient.rpc(
            "assistants.tasks.list", input: Input(agentId: agentId, organizationId: orgId)
        ) {
            self.tasks = response.tasks
        }
        isLoading = false
    }
}

struct AgentChannelsTab: View {
    let agent: Agent

    var body: some View {
        if let channels = agent.channels, !channels.isEmpty {
            List(channels) { channel in
                HStack {
                    Image(systemName: channelIcon(channel.type))
                    VStack(alignment: .leading) {
                        Text(channel.name ?? channel.type)
                            .font(.body)
                        Text(channel.type)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if channel.enabled {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                }
            }
        } else {
            ContentUnavailableView("No Channels", systemImage: "antenna.radiowaves.left.and.right", description: Text("No channels configured for this agent."))
        }
    }

    private func channelIcon(_ type: String) -> String {
        switch type.lowercased() {
        case "whatsapp": "message.fill"
        case "telegram": "paperplane.fill"
        case "discord": "gamecontroller.fill"
        case "slack": "number"
        case "sms": "phone.fill"
        case "email": "envelope.fill"
        default: "antenna.radiowaves.left.and.right"
        }
    }
}

struct AgentLogsTab: View {
    @Environment(AppState.self) private var appState
    let agentId: String
    @State private var logs: [AgentLogEntry] = []
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if logs.isEmpty {
                ContentUnavailableView("No Logs", systemImage: "doc.text", description: Text("No log entries yet."))
            } else {
                List(logs) { entry in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(entry.level.uppercased())
                                .font(.caption2.weight(.bold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(logLevelColor(entry.level).opacity(0.15))
                                .foregroundStyle(logLevelColor(entry.level))
                                .clipShape(Capsule())
                            Spacer()
                            Text(entry.timestamp)
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                        Text(entry.message)
                            .font(.caption)
                            .lineLimit(4)
                    }
                    .padding(.vertical, 2)
                }
                .refreshable { await loadLogs() }
            }
        }
        .task { await loadLogs() }
    }

    private func loadLogs() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        struct Input: Codable { let agentId: String; let organizationId: String }
        struct Response: Codable { let logs: [AgentLogEntry] }
        if let response: Response = try? await appState.apiClient.rpc(
            "assistants.agents.logs", input: Input(agentId: agentId, organizationId: orgId)
        ) {
            self.logs = response.logs
        }
        isLoading = false
    }

    private func logLevelColor(_ level: String) -> Color {
        switch level.lowercased() {
        case "error": .red
        case "warn", "warning": .orange
        case "info": .blue
        case "debug": .secondary
        default: .primary
        }
    }
}

struct AgentLogEntry: Codable, Identifiable {
    let id: String
    let level: String
    let message: String
    let timestamp: String
}

struct AgentConfigTab: View {
    @Environment(AppState.self) private var appState
    let agent: Agent

    var body: some View {
        List {
            Section("Agent Configuration") {
                LabeledContent("Name", value: agent.name)
                LabeledContent("ID", value: agent.id)
                    .font(.caption)
                LabeledContent("Status", value: agent.status.rawValue.capitalized)
            }

            if let containers = agent.containers, !containers.isEmpty {
                Section("Containers") {
                    ForEach(containers) { container in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(container.id)
                                .font(.caption.monospaced())
                            Text(container.status)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Section {
                Text("Full configuration editing is available in the web dashboard.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
