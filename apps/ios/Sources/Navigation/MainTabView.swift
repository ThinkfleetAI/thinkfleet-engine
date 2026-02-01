import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab = Tab.agents

    enum Tab: Hashable {
        case agents
        case tasks
        case settings
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab.agents.tab {
                NavigationStack {
                    AgentListView()
                        .toolbar {
                            ToolbarItem(placement: .topBarLeading) {
                                OrgSwitcherButton()
                            }
                        }
                }
            }

            Tab.tasks.tab {
                NavigationStack {
                    TaskListView()
                }
            }

            Tab.settings.tab {
                NavigationStack {
                    SettingsRootView()
                }
            }
        }
        .task {
            await appState.restoreSessionIfNeeded()
            if appState.sessionStore.isAuthenticated {
                await appState.onAuthenticated()
            }
        }
    }
}

private extension MainTabView.Tab {
    @ViewBuilder
    func tab<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .tabItem {
                switch self {
                case .agents:
                    Label("Agents", systemImage: "cpu")
                case .tasks:
                    Label("Tasks", systemImage: "checklist")
                case .settings:
                    Label("Settings", systemImage: "gearshape")
                }
            }
            .tag(self)
    }
}

// MARK: - Org Switcher

struct OrgSwitcherButton: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Menu {
            ForEach(appState.organizations) { org in
                Button {
                    appState.selectOrganization(org)
                } label: {
                    HStack {
                        Text(org.name)
                        if org.id == appState.currentOrganization?.id {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "building.2")
                Text(appState.currentOrganization?.name ?? "Organization")
                    .fontWeight(.medium)
                Image(systemName: "chevron.down")
                    .font(.caption)
            }
        }
    }
}

// MARK: - Placeholder Views (Phase 2+)

// TaskListView is now in Tasks/TaskBoardView.swift (TaskBoardView)
// This thin wrapper routes to it
struct TaskListView: View {
    var body: some View {
        TaskBoardView()
    }
}

struct SettingsRootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        List {
            if let user = appState.sessionStore.currentUser {
                Section {
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .font(.title)
                            .foregroundStyle(.secondary)
                        VStack(alignment: .leading) {
                            Text(user.name ?? "User")
                                .font(.headline)
                            Text(user.email)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Section("Account") {
                NavigationLink("General", destination: AccountSettingsView())
                NavigationLink("Security", destination: SecuritySettingsView())
            }

            Section("Organization") {
                NavigationLink("Members", destination: OrgSettingsView())
                NavigationLink("Credentials", destination: CredentialListView())
                NavigationLink("Personas", destination: PersonaListView())
                NavigationLink("Workflows", destination: WorkflowListView())
                NavigationLink("Billing", destination: BillingView())
            }

            Section {
                Button("Sign Out", role: .destructive) {
                    Task { await appState.signOut() }
                }
            }
        }
        .navigationTitle("Settings")
    }
}
