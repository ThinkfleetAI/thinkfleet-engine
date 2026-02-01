import SwiftUI

struct AgentChatView: View {
    @Environment(AppState.self) private var appState
    let agent: Agent

    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isSending = false
    @State private var isSubscribed = false

    var body: some View {
        VStack(spacing: 0) {
            if agent.status != .RUNNING {
                agentNotRunningBanner
            }

            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(messages) { message in
                            ChatBubble(message: message)
                                .id(message.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: messages.count) {
                    if let last = messages.last {
                        withAnimation {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            Divider()

            // Input
            HStack(spacing: 12) {
                TextField("Message...", text: $inputText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1 ... 5)
                    .disabled(agent.status != .RUNNING)

                Button {
                    Task { await sendMessage() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                }
                .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty || isSending || agent.status != .RUNNING)
            }
            .padding()
        }
        .task {
            await loadHistory()
            subscribeToEvents()
        }
        .onDisappear {
            unsubscribe()
        }
    }

    private var agentNotRunningBanner: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)
            Text("Agent is not running. Start it to chat.")
                .font(.caption)
        }
        .padding(8)
        .frame(maxWidth: .infinity)
        .background(.yellow.opacity(0.1))
    }

    private func loadHistory() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        struct Input: Codable { let agentId: String; let organizationId: String }
        let input = Input(agentId: agent.id, organizationId: orgId)
        if let response: ChatHistoryResponse = try? await appState.apiClient.rpc("assistants.chat.history", input: input) {
            self.messages = response.messages
        }
    }

    private func sendMessage() async {
        let text = inputText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }

        inputText = ""
        isSending = true

        // Optimistic local message
        let localMsg = ChatMessage(
            id: UUID().uuidString,
            content: text,
            role: "user",
            agentId: agent.id,
            userId: appState.sessionStore.currentUser?.id,
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
        messages.append(localMsg)

        // Send via Socket.IO RPC
        do {
            _ = try await appState.socketManager.sendRPC(
                agentId: agent.id,
                method: "chat.send",
                params: ["message": text]
            )
        } catch {
            // Message send failed - could show error UI
        }

        isSending = false
    }

    private func subscribeToEvents() {
        guard !isSubscribed else { return }
        isSubscribed = true

        appState.socketManager.subscribeToAgent(agent.id) { _, event in
            if let type = event["type"] as? String, type == "chat",
               let payload = event["payload"] as? [String: Any],
               let content = payload["content"] as? String,
               let role = payload["role"] as? String
            {
                let msg = ChatMessage(
                    id: payload["id"] as? String ?? UUID().uuidString,
                    content: content,
                    role: role,
                    agentId: agent.id,
                    userId: nil,
                    createdAt: payload["createdAt"] as? String ?? ISO8601DateFormatter().string(from: Date())
                )
                Task { @MainActor in
                    messages.append(msg)
                }
            }
        }
    }

    private func unsubscribe() {
        appState.socketManager.unsubscribeFromAgent(agent.id)
        isSubscribed = false
    }
}

struct ChatBubble: View {
    let message: ChatMessage

    private var isUser: Bool { message.role == "user" }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 60) }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.body)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isUser ? Color.accentColor : Color(.systemGray5))
                    .foregroundStyle(isUser ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }

            if !isUser { Spacer(minLength: 60) }
        }
    }
}
