import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab = Tab.agents

    enum Tab: Hashable {
        case agents
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
            await appState.onAuthenticated()
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

// MARK: - SaaS Chat View (agent chat via SaaS API + Socket.IO streaming)

struct SaaSChatView: View {
    @Environment(AppState.self) private var appState
    let agentId: String
    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isLoading = true
    @State private var isStreaming = false
    @State private var streamingMessageId: String?

    // Attachment state
    @State private var pendingAttachments: [PendingAttachment] = []
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var showDocumentPicker = false

    // Voice-to-text
    @State private var speechHelper = SpeechToTextHelper()
    @FocusState private var isInputFocused: Bool

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespaces).isEmpty || !pendingAttachments.isEmpty
    }

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
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(messages) { msg in
                                ChatBubble(message: msg)
                                    .id(msg.id)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) {
                        if let last = messages.last {
                            withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                        }
                    }
                    .onChange(of: messages.last?.content) {
                        if let last = messages.last {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            Divider()

            // Attachment previews
            if !pendingAttachments.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(pendingAttachments) { att in
                            AttachmentPreview(attachment: att) {
                                pendingAttachments.removeAll { $0.id == att.id }
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.top, 8)
                }
            }

            // Speech error
            if let speechError = speechHelper.error {
                Text(speechError)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
                    .padding(.top, 4)
            }

            // Typing indicator
            if isStreaming {
                HStack(spacing: 4) {
                    TypingDotsView()
                    Text("AI is responding...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.top, 6)
            }

            // Input bar
            HStack(spacing: 8) {
                // Photo picker button
                PhotosPicker(
                    selection: $selectedPhotos,
                    maxSelectionCount: max(1, 4 - pendingAttachments.count),
                    matching: .any(of: [.images, .screenshots])
                ) {
                    Image(systemName: "photo")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }

                // Document picker button
                Button {
                    showDocumentPicker = true
                } label: {
                    Image(systemName: "paperclip")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }

                TextField("Message...", text: $inputText, axis: .vertical)
                    .lineLimit(1 ... 4)
                    .textFieldStyle(.roundedBorder)
                    .focused($isInputFocused)

                // Mic button for voice-to-text
                Button {
                    speechHelper.toggleListening()
                } label: {
                    Image(systemName: speechHelper.isListening ? "mic.fill" : "mic")
                        .font(.title3)
                        .foregroundStyle(speechHelper.isListening ? .red : .secondary)
                        .symbolEffect(.pulse, isActive: speechHelper.isListening)
                }

                Button {
                    Task { await sendMessage() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                }
                .disabled(!canSend)
            }
            .padding()
        }
        .task {
            await loadHistory()
            subscribeToEvents()
        }
        .onDisappear {
            speechHelper.stopListening()
            appState.socketManager.unsubscribeFromAgent(agentId)
        }
        .onChange(of: speechHelper.transcript) {
            if !speechHelper.transcript.isEmpty {
                inputText = speechHelper.transcript
            }
        }
        .onChange(of: selectedPhotos) {
            Task { await loadSelectedPhotos() }
        }
        .sheet(isPresented: $showDocumentPicker) {
            DocumentPicker { data, filename, mimeType in
                guard pendingAttachments.count < 4 else { return }
                // Compress images picked from Files app too
                let finalData: Data
                let finalMime: String
                if mimeType.hasPrefix("image/"), let uiImage = UIImage(data: data) {
                    finalData = uiImage.compressedForChat() ?? data
                    finalMime = "image/jpeg"
                } else {
                    finalData = data
                    finalMime = mimeType
                }
                guard finalData.count <= 2_000_000 else { return } // 2MB max
                let base64 = finalData.base64EncodedString()
                pendingAttachments.append(PendingAttachment(
                    id: UUID().uuidString,
                    fileName: filename,
                    mimeType: finalMime,
                    base64: base64,
                    thumbnailData: finalMime.hasPrefix("image/") ? finalData : nil
                ))
            }
        }
    }

    private func loadSelectedPhotos() async {
        for item in selectedPhotos {
            guard pendingAttachments.count < 4 else { break }
            guard let data = try? await item.loadTransferable(type: Data.self) else { continue }

            // Compress image for Socket.IO transport (raw photos are too large)
            let compressed: Data
            if let uiImage = UIImage(data: data) {
                compressed = uiImage.compressedForChat() ?? data
            } else {
                compressed = data
            }
            guard compressed.count <= 2_000_000 else { continue } // 2MB max after compression

            let fileName = "photo_\(Date().timeIntervalSince1970).jpg"
            let base64 = compressed.base64EncodedString()
            pendingAttachments.append(PendingAttachment(
                id: UUID().uuidString,
                fileName: fileName,
                mimeType: "image/jpeg",
                base64: base64,
                thumbnailData: compressed
            ))
        }
        selectedPhotos = []
    }

    private func loadHistory() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        isLoading = true
        let input = ChatHistoryInput(agentId: agentId, organizationId: orgId, limit: 50)
        if let response: ChatHistoryFullResponse = try? await appState.apiClient.rpc(
            "assistants.chat.history",
            input: input
        ) {
            messages = response.messages
        }
        isLoading = false
    }

    private func subscribeToEvents() {
        appState.socketManager.subscribeToChatEvents(agentId) { event in
            Task { @MainActor in
                handleChatEvent(event)
            }
        }
    }

    @MainActor
    private func handleChatEvent(_ event: ChatEventPayload) {
        guard let text = event.text, !text.isEmpty else {
            if event.state == "final" || event.state == "error" {
                isStreaming = false
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
            isStreaming = true
            if let id = streamingMessageId,
               let idx = messages.firstIndex(where: { $0.id == id }) {
                messages[idx].content += text
            } else {
                let id = UUID().uuidString
                streamingMessageId = id
                let msg = ChatMessage(
                    id: id,
                    content: text,
                    role: role,
                    agentId: agentId,
                    userId: nil,
                    createdAt: ISO8601DateFormatter().string(from: Date()),
                    isStreaming: true
                )
                messages.append(msg)
            }

        case "final":
            isStreaming = false
            if let id = streamingMessageId,
               let idx = messages.firstIndex(where: { $0.id == id }) {
                messages[idx].isStreaming = false
                if messages[idx].content.isEmpty {
                    messages[idx].content = text
                }
            } else {
                let msg = ChatMessage(
                    id: UUID().uuidString,
                    content: text,
                    role: role,
                    agentId: agentId,
                    userId: nil,
                    createdAt: ISO8601DateFormatter().string(from: Date())
                )
                messages.append(msg)
            }
            streamingMessageId = nil

        case "error":
            isStreaming = false
            streamingMessageId = nil
            let msg = ChatMessage(
                id: UUID().uuidString,
                content: "Error: \(text)",
                role: "system",
                agentId: agentId,
                userId: nil,
                createdAt: ISO8601DateFormatter().string(from: Date())
            )
            messages.append(msg)

        default:
            break
        }
    }

    private func sendMessage() async {
        guard let orgId = appState.currentOrganization?.id else { return }
        let text = inputText.trimmingCharacters(in: .whitespaces)
        let attachments = pendingAttachments
        guard !text.isEmpty || !attachments.isEmpty else { return }
        isInputFocused = false
        inputText = ""
        pendingAttachments = []
        speechHelper.stopListening()

        let displayText = text.isEmpty
            ? "[Sent \(attachments.count) file\(attachments.count == 1 ? "" : "s")]"
            : text

        // Optimistic local message
        let userMsg = ChatMessage(
            id: UUID().uuidString,
            content: displayText,
            role: "user",
            agentId: agentId,
            userId: appState.sessionStore.currentUser?.id,
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
        messages.append(userMsg)
        isStreaming = true

        // Build RPC params with attachments
        var params: [String: Any] = [
            "message": text.isEmpty ? "[Uploaded \(attachments.count) file(s)]" : text,
            "sessionKey": "mobile:\(agentId)",
            "idempotencyKey": UUID().uuidString,
        ]
        if !attachments.isEmpty {
            params["attachments"] = attachments.map { att in
                ChatAttachmentInput(
                    mimeType: att.mimeType,
                    content: att.base64,
                    fileName: att.fileName
                ).asDictionary
            }
        }

        // Send via Socket.IO RPC
        do {
            _ = try await appState.socketManager.sendRPC(
                agentId: agentId,
                method: "chat.send",
                params: params
            )
        } catch {
            let errorMsg = ChatMessage(
                id: UUID().uuidString,
                content: "Failed to send: \(error.localizedDescription)",
                role: "system",
                agentId: agentId,
                userId: nil,
                createdAt: ISO8601DateFormatter().string(from: Date())
            )
            messages.append(errorMsg)
            isStreaming = false
        }

        // Persist text to SaaS chat history
        if !text.isEmpty {
            let saveInput = ChatSaveInput(agentId: agentId, organizationId: orgId, role: "user", content: text)
            _ = try? await appState.apiClient.rpc("assistants.chat.save", input: saveInput) as ChatMessage
        }
    }
}

// MARK: - Pending Attachment Model

struct PendingAttachment: Identifiable {
    let id: String
    let fileName: String
    let mimeType: String
    let base64: String
    let thumbnailData: Data?
}

// MARK: - Attachment Preview Chip

struct AttachmentPreview: View {
    let attachment: PendingAttachment
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            if let data = attachment.thumbnailData,
               let uiImage = UIImage(data: data) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 32, height: 32)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            } else {
                Image(systemName: iconForMimeType(attachment.mimeType))
                    .foregroundStyle(.secondary)
            }
            Text(attachment.fileName)
                .font(.caption)
                .lineLimit(1)
            Button {
                onRemove()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color(.systemGray6))
        .clipShape(Capsule())
    }

    private func iconForMimeType(_ mime: String) -> String {
        if mime.hasPrefix("image/") { return "photo" }
        if mime.hasPrefix("video/") { return "film" }
        if mime.contains("pdf") { return "doc.richtext" }
        return "doc"
    }
}

// MARK: - Typing Indicator

struct TypingDotsView: View {
    @State private var phase = 0

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0 ..< 3, id: \.self) { index in
                Circle()
                    .fill(Color.secondary)
                    .frame(width: 6, height: 6)
                    .offset(y: phase == index ? -4 : 0)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.4).repeatForever(autoreverses: true)) {
                phase = 1
            }
            // Stagger the animation by cycling through phases
            Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { _ in
                withAnimation(.easeInOut(duration: 0.4)) {
                    phase = (phase + 1) % 3
                }
            }
        }
    }
}

// MARK: - Image Compression

extension UIImage {
    /// Resize to fit within max dimension and JPEG compress for chat transport.
    func compressedForChat(maxDimension: CGFloat = 1024, quality: CGFloat = 0.7) -> Data? {
        let ratio = min(maxDimension / size.width, maxDimension / size.height, 1.0)
        let newSize = CGSize(width: size.width * ratio, height: size.height * ratio)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        let resized = renderer.image { _ in
            draw(in: CGRect(origin: .zero, size: newSize))
        }
        return resized.jpegData(compressionQuality: quality)
    }
}

// MARK: - Document Picker

struct DocumentPicker: UIViewControllerRepresentable {
    let onPick: (Data, String, String) -> Void

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [
            .image, .pdf, .plainText, .data,
        ])
        picker.delegate = context.coordinator
        picker.allowsMultipleSelection = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick) }

    class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onPick: (Data, String, String) -> Void
        init(onPick: @escaping (Data, String, String) -> Void) { self.onPick = onPick }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let url = urls.first else { return }
            guard url.startAccessingSecurityScopedResource() else { return }
            defer { url.stopAccessingSecurityScopedResource() }
            guard let data = try? Data(contentsOf: url) else { return }
            let filename = url.lastPathComponent
            let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            onPick(data, filename, mimeType)
        }
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

            if let org = appState.currentOrganization {
                Section {
                    LabeledContent("Organization", value: org.name)
                }
            }

            Section {
                Link(destination: URL(string: "https://www.thinkfleet.ai/app")!) {
                    HStack {
                        Label("Manage on Web", systemImage: "globe")
                        Spacer()
                        Image(systemName: "arrow.up.right.square")
                            .foregroundStyle(.secondary)
                    }
                }
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
