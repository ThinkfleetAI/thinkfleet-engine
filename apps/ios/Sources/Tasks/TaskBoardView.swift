import SwiftUI

struct TaskBoardView: View {
    @Environment(AppState.self) private var appState
    @State private var tasks: [AgentTask] = []
    @State private var isLoading = true
    @State private var selectedFilter: TaskStatus? = nil
    @State private var selectedAgentId: String?
    @State private var selectedCrewId: String?
    @State private var showCreateTask = false

    enum SourceMode: String, CaseIterable {
        case all = "All"
        case agent = "Agent"
        case crew = "Crew"
    }

    @State private var sourceMode: SourceMode = .all

    var filteredTasks: [AgentTask] {
        var result = tasks

        // Filter by agent/crew
        if sourceMode == .agent, let agentId = selectedAgentId {
            result = result.filter { $0.agentId == agentId }
        }

        // Filter by status
        if let filter = selectedFilter {
            result = result.filter { $0.status == filter }
        }

        return result
    }

    var body: some View {
        VStack(spacing: 0) {
            // Source selector (All / Agent / Crew)
            if !appState.agents.isEmpty || !appState.crews.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(label: "All", isSelected: sourceMode == .all) {
                            sourceMode = .all
                            selectedAgentId = nil
                            selectedCrewId = nil
                        }
                        ForEach(appState.agents) { agent in
                            FilterChip(
                                label: agent.name,
                                isSelected: sourceMode == .agent && selectedAgentId == agent.id
                            ) {
                                sourceMode = .agent
                                selectedAgentId = agent.id
                                selectedCrewId = nil
                            }
                        }
                        ForEach(appState.crews) { crew in
                            FilterChip(
                                label: "🤝 \(crew.name)",
                                isSelected: sourceMode == .crew && selectedCrewId == crew.id
                            ) {
                                sourceMode = .crew
                                selectedCrewId = crew.id
                                selectedAgentId = nil
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical, 6)
            }

            // Status filter chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    FilterChip(label: "All", isSelected: selectedFilter == nil) {
                        selectedFilter = nil
                    }
                    ForEach([TaskStatus.todo, .in_progress, .delivered, .done], id: \.self) { status in
                        FilterChip(label: status.displayName, isSelected: selectedFilter == status) {
                            selectedFilter = status
                        }
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical, 6)

            Divider()

            if isLoading {
                Spacer()
                ProgressView()
                Spacer()
            } else if filteredTasks.isEmpty {
                ContentUnavailableView("No Tasks", systemImage: "checklist", description: Text("Create a task to get started."))
            } else {
                List(filteredTasks) { task in
                    TaskRow(task: task, agents: appState.agents)
                }
                .refreshable { await loadTasks() }
            }
        }
        .navigationTitle("Tasks")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showCreateTask = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showCreateTask) {
            CreateTaskSheet { await loadTasks() }
        }
        .task { await loadTasks() }
    }

    private func loadTasks() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        struct Input: Codable { let organizationId: String }
        if let response: TaskListResponse = try? await appState.apiClient.rpc(
            "assistants.tasks.list", input: Input(organizationId: orgId)
        ) {
            self.tasks = response.tasks
        }
        isLoading = false
    }
}

struct TaskRow: View {
    let task: AgentTask
    let agents: [Agent]

    private var assignedAgentName: String? {
        if let delegatedId = task.delegatedToAgentId {
            return agents.first(where: { $0.id == delegatedId })?.name
        }
        return agents.first(where: { $0.id == task.agentId })?.name
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: task.status.icon)
                .foregroundStyle(task.status.color)

            VStack(alignment: .leading, spacing: 4) {
                Text(task.title)
                    .font(.body.weight(.medium))
                    .lineLimit(2)

                HStack(spacing: 8) {
                    Text(task.status.displayName)
                        .font(.caption)
                        .foregroundStyle(task.status.color)

                    if let urgency = task.urgency {
                        UrgencyBadge(urgency: urgency)
                    }

                    if let delegationStatus = task.delegationStatus, !delegationStatus.isEmpty {
                        Text(delegationStatus)
                            .font(.caption2)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(Color.purple.opacity(0.15))
                            .foregroundStyle(.purple)
                            .clipShape(Capsule())
                    }

                    if let labels = task.labels, !labels.isEmpty {
                        Text(labels.joined(separator: ", "))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                if let agentName = assignedAgentName {
                    HStack(spacing: 4) {
                        Image(systemName: "cpu")
                            .font(.caption2)
                        Text(agentName)
                            .font(.caption2)
                    }
                    .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct UrgencyBadge: View {
    let urgency: Int

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    private var label: String {
        switch urgency {
        case 1: "Critical"
        case 2: "High"
        case 3: "Medium"
        default: "Low"
        }
    }

    private var color: Color {
        switch urgency {
        case 1: .red
        case 2: .orange
        case 3: .yellow
        default: .secondary
        }
    }
}

struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor.opacity(0.15) : Color(.systemGray6))
                .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
                .clipShape(Capsule())
        }
    }
}

extension TaskStatus {
    var displayName: String {
        switch self {
        case .todo: "To Do"
        case .in_progress: "In Progress"
        case .delivered: "Delivered"
        case .done: "Done"
        case .archived: "Archived"
        }
    }

    var icon: String {
        switch self {
        case .todo: "circle"
        case .in_progress: "circle.dotted.circle"
        case .delivered: "shippingbox.fill"
        case .done: "checkmark.circle.fill"
        case .archived: "archivebox"
        }
    }

    var color: Color {
        switch self {
        case .todo: .secondary
        case .in_progress: .blue
        case .delivered: .purple
        case .done: .green
        case .archived: .secondary
        }
    }
}

// MARK: - Create Task

struct CreateTaskSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var agentId = ""
    @State private var urgency = 4
    @State private var isCreating = false
    @State private var errorMessage: String?
    let onCreated: () async -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Task") {
                    TextField("Title", text: $title)
                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .lineLimit(3 ... 6)
                }

                Section("Priority") {
                    Picker("Urgency", selection: $urgency) {
                        Text("Low").tag(4)
                        Text("Medium").tag(3)
                        Text("High").tag(2)
                        Text("Critical").tag(1)
                    }
                    .pickerStyle(.segmented)
                }

                if !appState.agents.isEmpty {
                    Section("Assign to Agent") {
                        Picker("Agent", selection: $agentId) {
                            Text("None").tag("")
                            ForEach(appState.agents) { agent in
                                Text(agent.name).tag(agent.id)
                            }
                        }
                    }
                }

                if let error = errorMessage {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("New Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await createTask() } }
                        .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isCreating)
                }
            }
        }
    }

    private func createTask() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isCreating = true
        errorMessage = nil

        let assignedAgent = agentId.isEmpty ? appState.agents.first?.id ?? "" : agentId
        let input = CreateTaskInput(
            agentId: assignedAgent,
            organizationId: orgId,
            title: title.trimmingCharacters(in: .whitespaces),
            description: description.isEmpty ? nil : description,
            status: "todo",
            taskType: "generic",
            urgency: urgency
        )

        do {
            let _: TaskResponse = try await appState.apiClient.rpc("assistants.tasks.create", input: input)
            await onCreated()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
        isCreating = false
    }
}
