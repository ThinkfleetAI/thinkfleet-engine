import Contacts
import Foundation
import ThinkFleetKit

actor ContactService {
    private let store = CNContactStore()

    func ensureAccess() async -> Bool {
        let status = CNContactStore.authorizationStatus(for: .contacts)
        switch status {
        case .authorized:
            return true
        case .notDetermined:
            return (try? await store.requestAccess(for: .contacts)) ?? false
        default:
            return false
        }
    }

    func searchContacts(query: String, limit: Int) async throws -> [ThinkFleetBotContactInfo] {
        guard await ensureAccess() else { return [] }

        let keysToFetch: [CNKeyDescriptor] = [
            CNContactIdentifierKey as CNKeyDescriptor,
            CNContactGivenNameKey as CNKeyDescriptor,
            CNContactFamilyNameKey as CNKeyDescriptor,
            CNContactEmailAddressesKey as CNKeyDescriptor,
            CNContactPhoneNumbersKey as CNKeyDescriptor,
            CNContactOrganizationNameKey as CNKeyDescriptor,
        ]

        let request = CNContactFetchRequest(keysToFetch: keysToFetch)
        request.predicate = CNContact.predicateForContacts(matchingName: query)

        var results: [ThinkFleetBotContactInfo] = []
        try store.enumerateContacts(with: request) { contact, stop in
            results.append(self.toContactInfo(contact))
            if results.count >= limit {
                stop.pointee = true
            }
        }
        return results
    }

    func getContact(id: String) async throws -> ThinkFleetBotContactInfo? {
        guard await ensureAccess() else { return nil }

        let keysToFetch: [CNKeyDescriptor] = [
            CNContactIdentifierKey as CNKeyDescriptor,
            CNContactGivenNameKey as CNKeyDescriptor,
            CNContactFamilyNameKey as CNKeyDescriptor,
            CNContactEmailAddressesKey as CNKeyDescriptor,
            CNContactPhoneNumbersKey as CNKeyDescriptor,
            CNContactOrganizationNameKey as CNKeyDescriptor,
        ]

        guard let contact = try? store.unifiedContact(withIdentifier: id, keysToFetch: keysToFetch) else {
            return nil
        }
        return toContactInfo(contact)
    }

    private nonisolated func toContactInfo(_ contact: CNContact) -> ThinkFleetBotContactInfo {
        ThinkFleetBotContactInfo(
            id: contact.identifier,
            givenName: contact.givenName,
            familyName: contact.familyName,
            emails: contact.emailAddresses.map { $0.value as String },
            phones: contact.phoneNumbers.map { $0.value.stringValue },
            organization: contact.organizationName.isEmpty ? nil : contact.organizationName
        )
    }
}
