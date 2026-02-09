import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab = Tab.agents

    enum Tab: Hashable {
        case agents
        case chat
        case tasks
        case deliverables
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

            Tab.chat.tab {
                NavigationStack {
                    ChatRootView()
                }
            }

            Tab.tasks.tab {
                NavigationStack {
                    TaskListView()
                }
            }

            Tab.deliverables.tab {
                NavigationStack {
                    DeliverableListView()
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
                case .chat:
                    Label("Chat", systemImage: "bubble.left.and.bubble.right")
                case .tasks:
                    Label("Tasks", systemImage: "checklist")
                case .deliverables:
                    Label("Deliverables", systemImage: "archivebox")
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

// MARK: - Chat Root View

struct ChatRootView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedAgentId: String?
    @State private var chatMode: ChatMode = .agents

    enum ChatMode: String, CaseIterable {
        case agents = "Agents"
        case crews = "Crews"
    }

    private var runningAgents: [Agent] {
        appState.agents.filter { $0.status == .RUNNING }
    }

    private var activeCrews: [Crew] {
        appState.crews.filter { $0.status == .active }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Segmented control: Agents / Crews
            Picker("Mode", selection: $chatMode) {
                ForEach(ChatMode.allCases, id: \.self) { mode in
                    Text(mode.rawValue).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 8)

            if chatMode == .agents {
                agentChatContent
            } else {
                crewChatContent
            }
        }
        .navigationTitle("Chat")
    }

    @ViewBuilder
    private var agentChatContent: some View {
        if runningAgents.isEmpty {
            ContentUnavailableView {
                Label("No Running Agents", systemImage: "bubble.left.and.bubble.right")
            } description: {
                Text("Start an agent to begin chatting.")
            }
        } else {
            // Agent selector pills
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(runningAgents) { agent in
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
            .padding(.bottom, 8)

            Divider()

            if selectedAgentId != nil {
                SaaSChatView(agentId: selectedAgentId!)
            } else {
                ContentUnavailableView {
                    Label("Select an Agent", systemImage: "hand.tap")
                } description: {
                    Text("Choose an agent above to start chatting.")
                }
            }
        }
    }

    @ViewBuilder
    private var crewChatContent: some View {
        if activeCrews.isEmpty {
            ContentUnavailableView {
                Label("No Active Crews", systemImage: "person.3")
            } description: {
                Text("Create a crew to start group conversations.")
            }
        } else {
            List(activeCrews) { crew in
                NavigationLink(destination: CrewChatView(crew: crew)) {
                    HStack(spacing: 12) {
                        Image(systemName: "person.3.fill")
                            .foregroundStyle(.blue)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(crew.name)
                                .font(.body.weight(.medium))
                            if let memberCount = crew.members?.count {
                                Text("\(memberCount) members")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - SaaS Chat View (agent chat via SaaS API)

struct SaaSChatView: View {
    @Environment(AppState.self) private var appState
    let agentId: String
    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isLoading = true

    var body: some View {
        VStack(spacing: 0) {
            if isLoading && messages.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if messages.isEmpty {
                Spacer()
                Text("Start a conversation")
                    .foregroundStyle(.secondary)
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(messages) { msg in
                            ChatBubble(message: msg)
                        }
                    }
                    .padding()
                }
            }

            Divider()

            HStack(spacing: 8) {
                TextField("Message...", text: $inputText, axis: .vertical)
                    .lineLimit(1 ... 4)
                    .textFieldStyle(.roundedBorder)

                Button {
                    Task { await sendMessage() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                }
                .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding()
        }
        .task { await loadHistory() }
    }

    private func loadHistory() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        struct Input: Codable { let agentId: String; let organizationId: String }
        if let response: ChatHistoryResponse = try? await appState.apiClient.rpc(
            "assistants.chats.history",
            input: Input(agentId: agentId, organizationId: orgId)
        ) {
            messages = response.messages
        }
        isLoading = false
    }

    private func sendMessage() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        let text = inputText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        inputText = ""

        let userMsg = ChatMessage(
            id: UUID().uuidString,
            content: text,
            role: "user",
            agentId: agentId,
            userId: appState.sessionStore.currentUser?.id,
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
        messages.append(userMsg)

        struct SendInput: Codable {
            let agentId: String
            let organizationId: String
            let content: String
        }
        struct SendResponse: Codable { let messageId: String? }
        _ = try? await appState.apiClient.rpc(
            "assistants.chats.send",
            input: SendInput(agentId: agentId, organizationId: orgId, content: text)
        ) as SendResponse
    }
}

// MARK: - Thin Wrappers

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
