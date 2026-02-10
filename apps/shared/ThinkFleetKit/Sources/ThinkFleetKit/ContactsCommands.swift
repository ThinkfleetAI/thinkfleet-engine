import Foundation

public enum ThinkFleetBotContactsCommand: String, Codable, Sendable {
    case search = "contacts.search"
    case get = "contacts.get"
}

public struct ThinkFleetBotContactsSearchParams: Codable, Sendable {
    public var query: String
    public var limit: Int?

    public init(query: String, limit: Int? = nil) {
        self.query = query
        self.limit = limit
    }
}

public struct ThinkFleetBotContactsGetParams: Codable, Sendable {
    public var id: String

    public init(id: String) {
        self.id = id
    }
}

public struct ThinkFleetBotContactInfo: Codable, Sendable {
    public var id: String
    public var givenName: String
    public var familyName: String
    public var emails: [String]
    public var phones: [String]
    public var organization: String?

    public init(id: String, givenName: String, familyName: String, emails: [String], phones: [String], organization: String? = nil) {
        self.id = id
        self.givenName = givenName
        self.familyName = familyName
        self.emails = emails
        self.phones = phones
        self.organization = organization
    }
}
