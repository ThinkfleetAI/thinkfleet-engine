import Foundation

public enum ThinkFleetBotCalendarCommand: String, Codable, Sendable {
    case upcoming = "calendar.upcoming"
    case create = "calendar.create"
    case search = "calendar.search"
}

public struct ThinkFleetBotCalendarUpcomingParams: Codable, Sendable {
    public var days: Int?
    public var limit: Int?

    public init(days: Int? = nil, limit: Int? = nil) {
        self.days = days
        self.limit = limit
    }
}

public struct ThinkFleetBotCalendarCreateParams: Codable, Sendable {
    public var title: String
    public var startDate: String
    public var endDate: String
    public var notes: String?
    public var location: String?
    public var isAllDay: Bool?

    public init(title: String, startDate: String, endDate: String, notes: String? = nil, location: String? = nil, isAllDay: Bool? = nil) {
        self.title = title
        self.startDate = startDate
        self.endDate = endDate
        self.notes = notes
        self.location = location
        self.isAllDay = isAllDay
    }
}

public struct ThinkFleetBotCalendarSearchParams: Codable, Sendable {
    public var query: String
    public var fromDate: String?
    public var toDate: String?
    public var limit: Int?

    public init(query: String, fromDate: String? = nil, toDate: String? = nil, limit: Int? = nil) {
        self.query = query
        self.fromDate = fromDate
        self.toDate = toDate
        self.limit = limit
    }
}

public struct ThinkFleetBotCalendarEvent: Codable, Sendable {
    public var id: String
    public var title: String
    public var startDate: String
    public var endDate: String
    public var location: String?
    public var notes: String?
    public var isAllDay: Bool
    public var calendarName: String?

    public init(id: String, title: String, startDate: String, endDate: String, location: String? = nil, notes: String? = nil, isAllDay: Bool, calendarName: String? = nil) {
        self.id = id
        self.title = title
        self.startDate = startDate
        self.endDate = endDate
        self.location = location
        self.notes = notes
        self.isAllDay = isAllDay
        self.calendarName = calendarName
    }
}
