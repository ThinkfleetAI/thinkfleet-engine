import Foundation
import Observation

@Observable
final class SessionStore: @unchecked Sendable {
    private static let service = "com.thinkfleet.ios"
    private static let tokenAccount = "session_token"
    private static let rawTokenAccount = "raw_session_token"
    private static let orgIdAccount = "organization_id"

    /// The signed session token (from Set-Cookie) — used for oRPC API calls.
    private(set) var sessionToken: String?
    /// The raw session token (from response body) — used for Socket.IO direct DB lookup.
    private(set) var rawToken: String?
    private(set) var currentUser: AuthUser?
    private(set) var currentOrganizationId: String?

    var isAuthenticated: Bool { sessionToken != nil && currentUser != nil }

    init() {
        self.sessionToken = KeychainStore.loadString(
            service: Self.service, account: Self.tokenAccount
        )
        self.rawToken = KeychainStore.loadString(
            service: Self.service, account: Self.rawTokenAccount
        )
        self.currentOrganizationId = KeychainStore.loadString(
            service: Self.service, account: Self.orgIdAccount
        )
    }

    func setSession(token: String, rawToken: String? = nil, user: AuthUser) {
        _ = KeychainStore.saveString(token, service: Self.service, account: Self.tokenAccount)
        self.sessionToken = token
        if let rawToken {
            _ = KeychainStore.saveString(rawToken, service: Self.service, account: Self.rawTokenAccount)
            self.rawToken = rawToken
        }
        self.currentUser = user
    }

    func setOrganization(id: String) {
        _ = KeychainStore.saveString(id, service: Self.service, account: Self.orgIdAccount)
        self.currentOrganizationId = id
    }

    func clearSession() {
        _ = KeychainStore.delete(service: Self.service, account: Self.tokenAccount)
        _ = KeychainStore.delete(service: Self.service, account: Self.rawTokenAccount)
        _ = KeychainStore.delete(service: Self.service, account: Self.orgIdAccount)
        self.sessionToken = nil
        self.rawToken = nil
        self.currentUser = nil
        self.currentOrganizationId = nil
    }
}

struct AuthUser: Codable, Sendable {
    let id: String
    let name: String?
    let email: String
    let image: String?
    let emailVerified: Bool
}
