import SwiftUI

struct CrewChatView: View {
    @Environment(AppState.self) private var appState
    let crew: Crew
    @State private var messages: [CrewChatMessage] = []
    @State private var inputText = ""
    @State private var isLoading = false
    @State private var showMentionPicker = false
    @State private var subscribedAgentIds: Set<String> = []
    @State private var streamingMessageIds: [String: String] = [:] // agentId → messageId

    private var runningMembers: [CrewMember] {
        crew.members?.filter { $0.agent?.status == .RUNNING } ?? []
    }

    var body: some View {
        VStack(spacing: 0) {
            // Member status bar
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(crew.members ?? []) { member in
                        if let agent = member.agent {
                            HStack(spacing: 4) {
                                AgentStatusIndicator(status: agent.status)
                                Text(agent.name)
                                    .font(.caption)
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color(.systemGray6))
                            .clipShape(Capsule())
                        }
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical, 6)

            Divider()

            // Messages
            if messages.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "bubble.left.and.bubble.right")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("Start a crew conversation")
                        .foregroundStyle(.secondary)
                    Text("Use @AgentName to message specific agents")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(messages) { msg in
                            CrewChatBubble(message: msg)
                        }
                    }
                    .padding()
                }
            }

            Divider()

            // Input
            HStack(spacing: 8) {
                Button {
                    showMentionPicker = true
                } label: {
                    Image(systemName: "at")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }

                TextField("Message the crew...", text: $inputText, axis: .vertical)
                    .lineLimit(1 ... 4)
                    .textFieldStyle(.roundedBorder)

                Button {
                    Task { await sendCrewMessage() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                }
                .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding()
        }
        .navigationTitle(crew.name)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            subscribeToCrewEvents()
        }
        .onDisappear {
            unsubscribeAll()
        }
        .sheet(isPresented: $showMentionPicker) {
            MentionPickerSheet(members: crew.members ?? []) { agentName in
                inputText += "@\(agentName) "
                showMentionPicker = false
            }
            .presentationDetents([.medium])
        }
    }

    private func subscribeToCrewEvents() {
        for member in runningMembers {
            let agentId = member.agentId
            let agentName = member.agent?.name ?? "Agent"
            guard !subscribedAgentIds.contains(agentId) else { continue }
            subscribedAgentIds.insert(agentId)

            appState.socketManager.subscribeToChatEvents(agentId) { event in
                Task { @MainActor in
                    handleCrewEvent(agentId: agentId, agentName: agentName, event: event)
                }
            }
        }
    }

    private func unsubscribeAll() {
        for agentId in subscribedAgentIds {
            appState.socketManager.unsubscribeFromAgent(agentId)
        }
        subscribedAgentIds.removeAll()
    }

    @MainActor
    private func handleCrewEvent(agentId: String, agentName: String, event: ChatEventPayload) {
        guard let text = event.text, !text.isEmpty else {
            if event.state == "final" || event.state == "error" {
                streamingMessageIds.removeValue(forKey: agentId)
            }
            return
        }

        switch event.state {
        case "delta":
            if let msgId = streamingMessageIds[agentId],
               let idx = messages.firstIndex(where: { $0.id == msgId }) {
                messages[idx] = CrewChatMessage(
                    id: msgId, text: messages[idx].text + text,
                    sender: .agent, agentId: agentId, agentName: agentName,
                    timestamp: messages[idx].timestamp, isStreaming: true
                )
            } else {
                let id = UUID().uuidString
                streamingMessageIds[agentId] = id
                messages.append(CrewChatMessage(
                    id: id, text: text,
                    sender: .agent, agentId: agentId, agentName: agentName,
                    timestamp: Date(), isStreaming: true
                ))
            }
        case "final":
            if let msgId = streamingMessageIds[agentId],
               let idx = messages.firstIndex(where: { $0.id == msgId }) {
                messages[idx] = CrewChatMessage(
                    id: msgId, text: messages[idx].text.isEmpty ? text : messages[idx].text,
                    sender: .agent, agentId: agentId, agentName: agentName,
                    timestamp: messages[idx].timestamp, isStreaming: false
                )
            } else {
                messages.append(CrewChatMessage(
                    id: UUID().uuidString, text: text,
                    sender: .agent, agentId: agentId, agentName: agentName,
                    timestamp: Date(), isStreaming: false
                ))
            }
            streamingMessageIds.removeValue(forKey: agentId)
        case "error":
            streamingMessageIds.removeValue(forKey: agentId)
            messages.append(CrewChatMessage(
                id: UUID().uuidString, text: "Error from \(agentName): \(text)",
                sender: .agent, agentId: agentId, agentName: agentName,
                timestamp: Date(), isStreaming: false
            ))
        default:
            break
        }
    }

    private func sendCrewMessage() async {
        let text = inputText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        inputText = ""

        let userMsg = CrewChatMessage(
            id: UUID().uuidString,
            text: text,
            sender: .user,
            agentId: nil,
            agentName: nil,
            timestamp: Date(),
            isStreaming: false
        )
        messages.append(userMsg)

        // Parse @mentions to determine target agents
        let mentionPattern = /@(\w+)/
        let mentioned = text.matches(of: mentionPattern).compactMap { match -> String? in
            let name = String(match.1)
            return crew.members?.first(where: { $0.agent?.name == name })?.agentId
        }

        // Send to mentioned agents, or all running members if no mentions
        let targetAgents = mentioned.isEmpty
            ? runningMembers.map(\.agentId)
            : mentioned

        for agentId in targetAgents {
            let params: [String: Any] = [
                "message": text,
                "sessionKey": "mobile-crew:\(agentId)",
                "idempotencyKey": UUID().uuidString,
            ]
            _ = try? await appState.socketManager.sendRPC(
                agentId: agentId,
                method: "chat.send",
                params: params
            )
        }
    }
}

// MARK: - Crew Chat Message

struct CrewChatMessage: Identifiable {
    let id: String
    let text: String
    let sender: Sender
    let agentId: String?
    let agentName: String?
    let timestamp: Date
    let isStreaming: Bool

    enum Sender {
        case user
        case agent
    }
}

struct CrewChatBubble: View {
    let message: CrewChatMessage

    private var isUser: Bool { message.sender == .user }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 60) }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 2) {
                if !isUser, let name = message.agentName {
                    Text(name)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(agentColor)
                }

                Text(message.text)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isUser ? Color.accentColor : Color(.systemGray5))
                    .foregroundStyle(isUser ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }

            if !isUser { Spacer(minLength: 60) }
        }
    }

    private var agentColor: Color {
        guard let name = message.agentName else { return .secondary }
        let hash = abs(name.hashValue)
        let colors: [Color] = [.blue, .purple, .orange, .teal, .pink, .indigo]
        return colors[hash % colors.count]
    }
}

// MARK: - Mention Picker

struct MentionPickerSheet: View {
    let members: [CrewMember]
    let onSelect: (String) -> Void

    var body: some View {
        NavigationStack {
            List {
                ForEach(members) { member in
                    if let agent = member.agent {
                        Button {
                            onSelect(agent.name)
                        } label: {
                            HStack(spacing: 12) {
                                AgentStatusIndicator(status: agent.status)
                                VStack(alignment: .leading) {
                                    Text(agent.name)
                                        .font(.body.weight(.medium))
                                    Text(member.role)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Mention Agent")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
