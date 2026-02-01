import Foundation

public enum ThinkFleetBotLocationMode: String, Codable, Sendable, CaseIterable {
    case off
    case whileUsing
    case always
}
