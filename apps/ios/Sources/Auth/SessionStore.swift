import Foundation
import Observation

@Observable
final class SessionStore: @unchecked Sendable {
    private static let service = "com.thinkfleet.ios"
    private static let tokenAccount = "session_token"
    private static let orgIdAccount = "organization_id"

    private(set) var sessionToken: String?
    private(set) var currentUser: AuthUser?
    private(set) var currentOrganizationId: String?

    var isAuthenticated: Bool { sessionToken != nil && currentUser != nil }

    init() {
        self.sessionToken = KeychainStore.loadString(
            service: Self.service, account: Self.tokenAccount
        )
        self.currentOrganizationId = KeychainStore.loadString(
            service: Self.service, account: Self.orgIdAccount
        )
    }

    func setSession(token: String, user: AuthUser) {
        _ = KeychainStore.saveString(token, service: Self.service, account: Self.tokenAccount)
        self.sessionToken = token
        self.currentUser = user
    }

    func setOrganization(id: String) {
        _ = KeychainStore.saveString(id, service: Self.service, account: Self.orgIdAccount)
        self.currentOrganizationId = id
    }

    func clearSession() {
        _ = KeychainStore.delete(service: Self.service, account: Self.tokenAccount)
        _ = KeychainStore.delete(service: Self.service, account: Self.orgIdAccount)
        self.sessionToken = nil
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
