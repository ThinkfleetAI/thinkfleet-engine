import SwiftUI

struct DocumentListView: View {
    @Environment(AppState.self) private var appState
    let agentId: String

    @State private var documents: [AgentDocument] = []
    @State private var isLoading = true
    @State private var searchQuery = ""

    var filteredDocs: [AgentDocument] {
        if searchQuery.isEmpty { return documents }
        return documents.filter {
            $0.name.localizedCaseInsensitiveContains(searchQuery)
        }
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if documents.isEmpty {
                ContentUnavailableView(
                    "No Documents",
                    systemImage: "doc.text",
                    description: Text("Upload documents for this agent to reference.")
                )
            } else {
                List(filteredDocs) { doc in
                    DocumentRow(document: doc) {
                        Task { await deleteDocument(doc.id) }
                    }
                }
                .searchable(text: $searchQuery, prompt: "Search documents")
            }
        }
        .task { await loadDocuments() }
    }

    private func loadDocuments() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true

        struct Input: Codable { let agentId: String; let organizationId: String }
        struct Response: Codable { let documents: [AgentDocument] }

        if let response: Response = try? await appState.apiClient.rpc(
            "assistants.documents.list",
            input: Input(agentId: agentId, organizationId: orgId)
        ) {
            self.documents = response.documents
        }
        isLoading = false
    }

    private func deleteDocument(_ docId: String) async {
        guard let orgId = appState.currentOrganization?.id else { return }
        struct Input: Codable { let documentId: String; let organizationId: String }
        struct Response: Codable { let success: Bool? }

        _ = try? await appState.apiClient.rpc(
            "assistants.documents.delete",
            input: Input(documentId: docId, organizationId: orgId)
        ) as Response
        await loadDocuments()
    }
}

struct AgentDocument: Codable, Identifiable, Sendable {
    let id: String
    let filename: String
    let fileSize: Int?
    let mimeType: String?
    let category: String?
    let description: String?
    let createdAt: String

    // Convenience for display
    var name: String { filename }
    var size: Int? { fileSize }
    var type: String? {
        if let ext = filename.split(separator: ".").last {
            return String(ext)
        }
        return mimeType
    }
}

struct DocumentRow: View {
    let document: AgentDocument
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: documentIcon)
                .font(.title3)
                .foregroundStyle(Color.accentColor)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(document.name)
                    .font(.body)
                    .lineLimit(1)
                HStack(spacing: 8) {
                    if let type = document.type {
                        Text(type.uppercased())
                            .font(.caption2.weight(.semibold))
                    }
                    if let size = document.size {
                        Text(ByteCountFormatter.string(fromByteCount: Int64(size), countStyle: .file))
                            .font(.caption2)
                    }
                }
                .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private var documentIcon: String {
        switch document.type?.lowercased() {
        case "pdf": "doc.fill"
        case "txt", "text": "doc.plaintext"
        case "md", "markdown": "doc.richtext"
        case "csv": "tablecells"
        default: "doc"
        }
    }
}
