import SwiftUI

struct WorkflowListView: View {
    @Environment(AppState.self) private var appState
    @State private var workflows: [Workflow] = []
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if workflows.isEmpty {
                ContentUnavailableView(
                    "No Workflows",
                    systemImage: "arrow.triangle.branch",
                    description: Text("Create workflows in the web dashboard to automate agent tasks.")
                )
            } else {
                List(workflows) { workflow in
                    NavigationLink(value: workflow.id) {
                        WorkflowRow(workflow: workflow)
                    }
                }
            }
        }
        .navigationTitle("Workflows")
        .navigationDestination(for: String.self) { workflowId in
            WorkflowDetailView(workflowId: workflowId)
        }
        .task { await loadWorkflows() }
    }

    private func loadWorkflows() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        struct Input: Codable { let organizationId: String }
        struct Response: Codable { let workflows: [Workflow] }

        if let response: Response = try? await appState.apiClient.rpc(
            "assistants.workflows.list", input: Input(organizationId: orgId)
        ) {
            self.workflows = response.workflows
        }
        isLoading = false
    }
}

struct Workflow: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let status: String?
    let createdAt: String
    let updatedAt: String
}

struct WorkflowRow: View {
    let workflow: Workflow

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(workflow.name)
                .font(.body.weight(.medium))
            if let desc = workflow.description {
                Text(desc)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            HStack {
                if let status = workflow.status {
                    Text(status.capitalized)
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.accentColor.opacity(0.1))
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct WorkflowDetailView: View {
    @Environment(AppState.self) private var appState
    let workflowId: String
    @State private var workflow: Workflow?
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if let workflow {
                List {
                    Section("Details") {
                        LabeledContent("Name", value: workflow.name)
                        if let desc = workflow.description {
                            LabeledContent("Description", value: desc)
                        }
                        if let status = workflow.status {
                            LabeledContent("Status", value: status.capitalized)
                        }
                        LabeledContent("Created", value: workflow.createdAt)
                    }

                    Section {
                        Button("Run Workflow") {
                            Task { await executeWorkflow() }
                        }
                        .buttonStyle(.borderedProminent)
                    }

                    Section {
                        Text("Workflow editing is available in the web dashboard.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } else {
                ContentUnavailableView("Workflow Not Found", systemImage: "exclamationmark.triangle")
            }
        }
        .navigationTitle(workflow?.name ?? "Workflow")
        .task { await loadWorkflow() }
    }

    private func loadWorkflow() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        struct Input: Codable { let workflowId: String; let organizationId: String }
        struct Response: Codable { let workflow: Workflow }

        if let response: Response = try? await appState.apiClient.rpc(
            "assistants.workflows.get", input: Input(workflowId: workflowId, organizationId: orgId)
        ) {
            self.workflow = response.workflow
        }
        isLoading = false
    }

    private func executeWorkflow() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        struct Input: Codable { let workflowId: String; let organizationId: String }
        struct Response: Codable { let executionId: String? }
        _ = try? await appState.apiClient.rpc(
            "assistants.workflows.execute", input: Input(workflowId: workflowId, organizationId: orgId)
        ) as Response
    }
}
