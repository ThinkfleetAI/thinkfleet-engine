import SwiftUI
import UIKit

struct DeliverableListView: View {
    @Environment(AppState.self) private var appState
    @State private var tasks: [AgentTask] = []
    @State private var attachments: [TaskAttachment] = []
    @State private var selectedAgentId: String?
    @State private var isLoading = true

    private var deliveredTasks: [AgentTask] {
        let filtered = tasks.filter { $0.status == .delivered || $0.status == .done }
        if let agentId = selectedAgentId {
            return filtered.filter { $0.agentId == agentId }
        }
        return filtered
    }

    var body: some View {
        VStack(spacing: 0) {
            // Agent filter
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    FilterChip(label: "All", isSelected: selectedAgentId == nil) {
                        selectedAgentId = nil
                    }
                    ForEach(appState.agents) { agent in
                        FilterChip(
                            label: agent.name,
                            isSelected: selectedAgentId == agent.id
                        ) {
                            selectedAgentId = agent.id
                        }
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical, 8)

            Divider()

            if isLoading {
                Spacer()
                ProgressView()
                Spacer()
            } else if deliveredTasks.isEmpty && attachments.isEmpty {
                ContentUnavailableView {
                    Label("No Deliverables", systemImage: "archivebox")
                } description: {
                    Text("Your agents haven't produced any deliverables yet.")
                }
            } else {
                List {
                    if !deliveredTasks.isEmpty {
                        Section("Task Outputs") {
                            ForEach(deliveredTasks) { task in
                                NavigationLink(destination: TaskDetailView(task: task, agents: appState.agents)) {
                                    DeliverableTaskRow(task: task)
                                }
                            }
                        }
                    }

                    if !attachments.isEmpty {
                        Section("File Attachments") {
                            ForEach(attachments) { attachment in
                                AttachmentRow(attachment: attachment)
                            }
                        }
                    }
                }
                .refreshable { await loadDeliverables() }
            }
        }
        .navigationTitle("Deliverables")
        .task { await loadDeliverables() }
    }

    private func loadDeliverables() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true

        struct TaskInput: Codable { let organizationId: String }
        if let response: TaskListResponse = try? await appState.apiClient.rpc(
            "assistants.tasks.listByOrg",
            input: TaskInput(organizationId: orgId)
        ) {
            tasks = response.tasks
        }

        // Load attachments for each agent
        var allAttachments: [TaskAttachment] = []
        for agent in appState.agents {
            let input = AttachmentListInput(agentId: agent.id, organizationId: orgId)
            if let response: AttachmentListResponse = try? await appState.apiClient.rpc(
                "assistants.attachments.listByAgent", input: input
            ) {
                allAttachments.append(contentsOf: response.attachments)
            }
        }
        attachments = allAttachments

        isLoading = false
    }
}

struct DeliverableTaskRow: View {
    let task: AgentTask

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(task.title)
                .font(.body.weight(.medium))

            if let deliverables = task.deliverables, !deliverables.isEmpty {
                Text(deliverables)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }

            HStack(spacing: 8) {
                Text(task.status == .delivered ? "Delivered" : "Done")
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(task.status == .delivered ? Color.blue.opacity(0.15) : Color.green.opacity(0.15))
                    .foregroundStyle(task.status == .delivered ? .blue : .green)
                    .clipShape(Capsule())

                if let urgency = task.urgency {
                    UrgencyBadge(urgency: urgency)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct AttachmentRow: View {
    @Environment(AppState.self) private var appState
    let attachment: TaskAttachment
    @State private var isDownloading = false

    var body: some View {
        Button {
            Task { await downloadAndOpen() }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: mimeIcon)
                    .font(.title2)
                    .foregroundStyle(.blue)
                    .frame(width: 32)

                VStack(alignment: .leading, spacing: 2) {
                    Text(attachment.filename)
                        .font(.body)
                        .lineLimit(1)
                        .foregroundStyle(.primary)
                    Text(formattedSize)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if isDownloading {
                    ProgressView()
                } else {
                    Image(systemName: "arrow.down.circle")
                        .foregroundStyle(.blue)
                }
            }
            .padding(.vertical, 4)
        }
        .disabled(isDownloading)
    }

    private func downloadAndOpen() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isDownloading = true
        defer { isDownloading = false }
        let input = AttachmentDownloadInput(
            attachmentId: attachment.id, taskId: attachment.taskId, organizationId: orgId
        )
        guard let response: AttachmentDownloadResponse = try? await appState.apiClient.rpc(
            "assistants.attachments.downloadUrl", input: input
        ) else { return }
        if let url = URL(string: response.downloadUrl) {
            await MainActor.run { UIApplication.shared.open(url) }
        }
    }

    private var mimeIcon: String {
        if attachment.mimeType.starts(with: "image/") { return "photo" }
        if attachment.mimeType.starts(with: "video/") { return "video" }
        if attachment.mimeType == "application/pdf" { return "doc.fill" }
        return "doc"
    }

    private var formattedSize: String {
        let bytes = attachment.fileSize
        if bytes < 1024 { return "\(bytes) B" }
        if bytes < 1_048_576 { return String(format: "%.1f KB", Double(bytes) / 1024) }
        return String(format: "%.1f MB", Double(bytes) / 1_048_576)
    }
}
