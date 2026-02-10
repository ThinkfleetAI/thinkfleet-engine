import AuthenticationServices
import SwiftUI

struct IntegrationListView: View {
    @Environment(AppState.self) private var appState
    @State private var connections: [ComposioConnection] = []
    @State private var isLoading = true
    @State private var showMarketplace = false

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if connections.isEmpty {
                ContentUnavailableView {
                    Label("No Integrations", systemImage: "puzzlepiece.extension")
                } description: {
                    Text("Connect cloud services like Gmail, Google Calendar, and more.")
                } actions: {
                    Button("Browse Marketplace") { showMarketplace = true }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                List {
                    ForEach(connections) { conn in
                        HStack(spacing: 12) {
                            Image(systemName: "puzzlepiece.extension.fill")
                                .foregroundStyle(conn.status == "active" ? .green : .orange)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(conn.appName)
                                    .font(.body.weight(.medium))
                                Text(conn.status.capitalized)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                    }
                }
            }
        }
        .navigationTitle("Integrations")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showMarketplace = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showMarketplace) {
            NavigationStack {
                IntegrationMarketplaceView {
                    Task { await loadConnections() }
                }
            }
        }
        .task { await loadConnections() }
    }

    private func loadConnections() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        let input = ComposioConnectionsInput(organizationId: orgId)
        if let response: ComposioConnectionsResponse = try? await appState.apiClient.rpc(
            "assistants.composio.connections", input: input
        ) {
            connections = response.connections
        }
        isLoading = false
    }
}

struct IntegrationMarketplaceView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var apps: [ComposioApp] = []
    @State private var isLoading = true
    @State private var searchText = ""
    @State private var connectingApp: String?
    let onConnected: () -> Void

    private var filteredApps: [ComposioApp] {
        if searchText.isEmpty { return apps }
        let query = searchText.lowercased()
        return apps.filter {
            $0.name.lowercased().contains(query)
                || ($0.displayName?.lowercased().contains(query) ?? false)
        }
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else {
                List(filteredApps) { app in
                    Button {
                        Task { await connectApp(app.name) }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "app.fill")
                                .foregroundStyle(.blue)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(app.displayName ?? app.name)
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(.primary)
                                if let cats = app.categories, !cats.isEmpty {
                                    Text(cats.joined(separator: ", "))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if connectingApp == app.name {
                                ProgressView()
                                    .controlSize(.small)
                            } else {
                                Image(systemName: "arrow.right.circle")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .disabled(connectingApp != nil)
                }
                .searchable(text: $searchText, prompt: "Search apps")
            }
        }
        .navigationTitle("Add Integration")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }
            }
        }
        .task { await loadApps() }
    }

    private func loadApps() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        let input = ComposioAppsInput(organizationId: orgId, oauthOnly: true)
        if let response: ComposioAppsResponse = try? await appState.apiClient.rpc(
            "assistants.composio.apps", input: input
        ) {
            apps = response.apps
        }
        isLoading = false
    }

    private func connectApp(_ appName: String) async {
        guard let orgId = appState.currentOrganization?.id else { return }
        connectingApp = appName

        let input = ComposioConnectInput(organizationId: orgId, appName: appName)
        if let response: ComposioConnectResponse = try? await appState.apiClient.rpc(
            "assistants.composio.connect", input: input
        ) {
            if let redirectUrl = response.redirectUrl, let url = URL(string: redirectUrl) {
                await openOAuth(url: url)
            }
            // If connected == true, it was an API key connection (no redirect needed)
        }

        connectingApp = nil
        onConnected()
    }

    @MainActor
    private func openOAuth(url: URL) async {
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: "thinkfleet"
            ) { _, _ in
                cont.resume()
            }
            session.prefersEphemeralWebBrowserSession = false
            session.presentationContextProvider = ASWebAuthPresentationContext.shared
            session.start()
        }
    }
}

// Helper for ASWebAuthenticationSession presentation
final class ASWebAuthPresentationContext: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = ASWebAuthPresentationContext()
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?.windows.first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
