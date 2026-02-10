import EventKit
import Foundation
import ThinkFleetKit

actor CalendarService {
    private let store = EKEventStore()

    func ensureAccess() async -> Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        switch status {
        case .authorized, .fullAccess:
            return true
        case .notDetermined:
            return (try? await store.requestFullAccessToEvents()) ?? false
        default:
            return false
        }
    }

    func getUpcomingEvents(days: Int, limit: Int) async throws -> [ThinkFleetBotCalendarEvent] {
        guard await ensureAccess() else { return [] }

        let start = Date()
        let end = Calendar.current.date(byAdding: .day, value: max(1, days), to: start) ?? start
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let events = store.events(matching: predicate)

        return Array(events.prefix(limit)).map { toCalendarEvent($0) }
    }

    func createEvent(params: ThinkFleetBotCalendarCreateParams) async throws -> ThinkFleetBotCalendarEvent {
        guard await ensureAccess() else {
            throw CalendarError.accessDenied
        }

        let formatter = ISO8601DateFormatter()
        guard let startDate = formatter.date(from: params.startDate),
              let endDate = formatter.date(from: params.endDate)
        else {
            throw CalendarError.invalidDate
        }

        let event = EKEvent(eventStore: store)
        event.title = params.title
        event.startDate = startDate
        event.endDate = endDate
        event.notes = params.notes
        event.location = params.location
        event.isAllDay = params.isAllDay ?? false
        event.calendar = store.defaultCalendarForNewEvents

        try store.save(event, span: .thisEvent)
        return toCalendarEvent(event)
    }

    func searchEvents(params: ThinkFleetBotCalendarSearchParams) async throws -> [ThinkFleetBotCalendarEvent] {
        guard await ensureAccess() else { return [] }

        let formatter = ISO8601DateFormatter()
        let from = params.fromDate.flatMap { formatter.date(from: $0) } ?? Date()
        let to = params.toDate.flatMap { formatter.date(from: $0) }
            ?? Calendar.current.date(byAdding: .month, value: 3, to: from) ?? from

        let predicate = store.predicateForEvents(withStart: from, end: to, calendars: nil)
        let allEvents = store.events(matching: predicate)

        let query = params.query.lowercased()
        let matched = allEvents.filter { event in
            (event.title?.lowercased().contains(query) ?? false)
                || (event.notes?.lowercased().contains(query) ?? false)
                || (event.location?.lowercased().contains(query) ?? false)
        }

        return Array(matched.prefix(params.limit ?? 20)).map { toCalendarEvent($0) }
    }

    private func toCalendarEvent(_ event: EKEvent) -> ThinkFleetBotCalendarEvent {
        let formatter = ISO8601DateFormatter()
        return ThinkFleetBotCalendarEvent(
            id: event.eventIdentifier ?? UUID().uuidString,
            title: event.title ?? "Untitled",
            startDate: formatter.string(from: event.startDate),
            endDate: formatter.string(from: event.endDate),
            location: event.location,
            notes: event.notes,
            isAllDay: event.isAllDay,
            calendarName: event.calendar?.title
        )
    }

    enum CalendarError: Error {
        case accessDenied
        case invalidDate
    }
}
