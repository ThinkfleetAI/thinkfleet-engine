import SwiftUI

struct AgentChatView: View {
    @Environment(AppState.self) private var appState
    let agent: Agent

    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isSending = false
    @State private var isSubscribed = false
    @State private var streamingMessageId: String?

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
        let input = ChatHistoryInput(agentId: agent.id, organizationId: orgId, limit: 50)
        if let response: ChatHistoryFullResponse = try? await appState.apiClient.rpc("assistants.chat.history", input: input) {
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

        // Send via Socket.IO RPC to forward through gateway to agent
        do {
            _ = try await appState.socketManager.sendRPC(
                agentId: agent.id,
                method: "chat.send",
                params: ["message": text, "sessionKey": "mobile:\(agent.id)", "idempotencyKey": UUID().uuidString]
            )
        } catch {
            messages.append(ChatMessage(
                id: UUID().uuidString,
                content: "Failed to send: \(error.localizedDescription)",
                role: "system",
                agentId: agent.id,
                userId: nil,
                createdAt: ISO8601DateFormatter().string(from: Date())
            ))
            isSending = false
        }
    }

    private func subscribeToEvents() {
        guard !isSubscribed else { return }
        isSubscribed = true

        appState.socketManager.subscribeToChatEvents(agent.id) { event in
            Task { @MainActor in
                handleChatEvent(event)
            }
        }
    }

    @MainActor
    private func handleChatEvent(_ event: ChatEventPayload) {
        guard let text = event.text, !text.isEmpty else {
            if event.state == "final" || event.state == "error" {
                isSending = false
                if let id = streamingMessageId,
                   let idx = messages.firstIndex(where: { $0.id == id }) {
                    messages[idx].isStreaming = false
                }
                streamingMessageId = nil
            }
            return
        }

        let role = event.role ?? "assistant"

        switch event.state {
        case "delta":
            if let id = streamingMessageId,
               let idx = messages.firstIndex(where: { $0.id == id }) {
                messages[idx].content += text
            } else {
                let id = UUID().uuidString
                streamingMessageId = id
                messages.append(ChatMessage(
                    id: id, content: text, role: role,
                    agentId: agent.id, userId: nil,
                    createdAt: ISO8601DateFormatter().string(from: Date()),
                    isStreaming: true
                ))
            }
        case "final":
            isSending = false
            if let id = streamingMessageId,
               let idx = messages.firstIndex(where: { $0.id == id }) {
                messages[idx].isStreaming = false
                if messages[idx].content.isEmpty { messages[idx].content = text }
            } else {
                messages.append(ChatMessage(
                    id: UUID().uuidString, content: text, role: role,
                    agentId: agent.id, userId: nil,
                    createdAt: ISO8601DateFormatter().string(from: Date())
                ))
            }
            streamingMessageId = nil
        case "error":
            isSending = false
            streamingMessageId = nil
            messages.append(ChatMessage(
                id: UUID().uuidString, content: "Error: \(text)", role: "system",
                agentId: agent.id, userId: nil,
                createdAt: ISO8601DateFormatter().string(from: Date())
            ))
        default:
            break
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
    private var isSystem: Bool { message.role == "system" }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 60) }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                if isSystem {
                    Text(message.content)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color(.systemOrange).opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                } else {
                    HStack(spacing: 6) {
                        Text(message.content)
                            .font(.body)
                        if message.isStreaming == true {
                            ProgressView()
                                .controlSize(.mini)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isUser ? Color.accentColor : Color(.systemGray5))
                    .foregroundStyle(isUser ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }
            }

            if !isUser { Spacer(minLength: 60) }
        }
    }
}
