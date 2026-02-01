import Foundation

public enum ThinkFleetBotChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(ThinkFleetBotChatEventPayload)
    case agent(ThinkFleetBotAgentEventPayload)
    case seqGap
}

public protocol ThinkFleetBotChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> ThinkFleetBotChatHistoryPayload
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [ThinkFleetBotChatAttachmentPayload]) async throws -> ThinkFleetBotChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> ThinkFleetBotChatSessionsListResponse

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<ThinkFleetBotChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension ThinkFleetBotChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "ThinkFleetBotChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> ThinkFleetBotChatSessionsListResponse {
        throw NSError(
            domain: "ThinkFleetBotChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }
}
