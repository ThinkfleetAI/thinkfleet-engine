import ThinkFleetKit
import ThinkFleetProtocol
import Foundation

// Prefer the ThinkFleetKit wrapper to keep gateway request payloads consistent.
typealias AnyCodable = ThinkFleetKit.AnyCodable
typealias InstanceIdentity = ThinkFleetKit.InstanceIdentity

extension AnyCodable {
    var stringValue: String? { self.value as? String }
    var boolValue: Bool? { self.value as? Bool }
    var intValue: Int? { self.value as? Int }
    var doubleValue: Double? { self.value as? Double }
    var dictionaryValue: [String: AnyCodable]? { self.value as? [String: AnyCodable] }
    var arrayValue: [AnyCodable]? { self.value as? [AnyCodable] }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}

extension ThinkFleetBotProtocol.AnyCodable {
    var stringValue: String? { self.value as? String }
    var boolValue: Bool? { self.value as? Bool }
    var intValue: Int? { self.value as? Int }
    var doubleValue: Double? { self.value as? Double }
    var dictionaryValue: [String: ThinkFleetBotProtocol.AnyCodable]? { self.value as? [String: ThinkFleetBotProtocol.AnyCodable] }
    var arrayValue: [ThinkFleetBotProtocol.AnyCodable]? { self.value as? [ThinkFleetBotProtocol.AnyCodable] }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: ThinkFleetBotProtocol.AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [ThinkFleetBotProtocol.AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}
