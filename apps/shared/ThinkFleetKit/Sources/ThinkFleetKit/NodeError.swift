import Foundation

public enum ThinkFleetBotNodeErrorCode: String, Codable, Sendable {
    case notPaired = "NOT_PAIRED"
    case unauthorized = "UNAUTHORIZED"
    case backgroundUnavailable = "NODE_BACKGROUND_UNAVAILABLE"
    case invalidRequest = "INVALID_REQUEST"
    case unavailable = "UNAVAILABLE"
}

public struct ThinkFleetBotNodeError: Error, Codable, Sendable, Equatable {
    public var code: ThinkFleetBotNodeErrorCode
    public var message: String
    public var retryable: Bool?
    public var retryAfterMs: Int?

    public init(
        code: ThinkFleetBotNodeErrorCode,
        message: String,
        retryable: Bool? = nil,
        retryAfterMs: Int? = nil)
    {
        self.code = code
        self.message = message
        self.retryable = retryable
        self.retryAfterMs = retryAfterMs
    }
}
