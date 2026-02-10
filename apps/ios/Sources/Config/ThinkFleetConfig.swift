import Foundation

enum ThinkFleetConfig {
    /// Base URL for the SaaS API.
    /// Override via `THINKFLEET_API_URL` environment variable or Info.plist `ThinkFleetAPIURL` key.
    static let apiBaseURL: URL = {
        // 1. Environment variable (debug/CI)
        if let envURL = ProcessInfo.processInfo.environment["THINKFLEET_API_URL"],
           let url = URL(string: envURL) {
            return url
        }
        // 2. Info.plist (build configuration)
        if let plistURL = Bundle.main.object(forInfoDictionaryKey: "ThinkFleetAPIURL") as? String,
           !plistURL.isEmpty,
           let url = URL(string: plistURL) {
            return url
        }
        // 3. Default — production
        return URL(string: "https://www.thinkfleet.ai")!
    }()

    static let socketIOPath = "/api/socket.io"
    static let rpcBasePath = "/api/rpc"
    static let authBasePath = "/api/auth"

    static let keychainService = "ai.thinkfleet.thinkfleetAI"
    static let appGroupIdentifier = "group.ai.thinkfleet.thinkfleetAI"
}
