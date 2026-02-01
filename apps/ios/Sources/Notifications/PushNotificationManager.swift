import Foundation
import UIKit
import UserNotifications

@Observable
final class PushNotificationManager: NSObject, @unchecked Sendable {
    private weak var appState: AppState?
    private(set) var isRegistered = false
    private(set) var permissionGranted = false
    private var deviceToken: String?

    func configure(appState: AppState) {
        self.appState = appState
        UNUserNotificationCenter.current().delegate = self
    }

    // MARK: - Permission & Registration

    func requestPermissionAndRegister() async {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            permissionGranted = granted
            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        } catch {
            permissionGranted = false
        }
    }

    func didRegisterForRemoteNotifications(deviceToken data: Data) {
        let token = data.map { String(format: "%02x", $0) }.joined()
        self.deviceToken = token
        Task { await registerTokenWithServer(token) }
    }

    func didFailToRegisterForRemoteNotifications(error: Error) {
        isRegistered = false
    }

    // MARK: - Server Registration

    private func registerTokenWithServer(_ token: String) async {
        guard let appState else { return }
        struct Input: Codable {
            let platform: String
            let token: String
            let deviceId: String?
            let appVersion: String?
            let organizationId: String?
        }
        struct Response: Codable {
            let id: String?
            let registered: Bool?
        }

        let deviceId = await UIDevice.current.identifierForVendor?.uuidString
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String

        let input = Input(
            platform: "IOS",
            token: token,
            deviceId: deviceId,
            appVersion: appVersion,
            organizationId: appState.currentOrganization?.id
        )

        if let response: Response = try? await appState.apiClient.rpc(
            "assistants.push.register", input: input
        ) {
            isRegistered = response.registered ?? false
        }
    }

    func unregisterToken() async {
        guard let appState, let token = deviceToken else { return }
        struct Input: Codable { let token: String }
        struct Response: Codable { let success: Bool? }
        _ = try? await appState.apiClient.rpc(
            "assistants.push.unregister", input: Input(token: token)
        ) as Response
        isRegistered = false
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension PushNotificationManager: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .badge, .sound]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo

        // Handle deep links from notification payload
        if let agentId = userInfo["agentId"] as? String {
            // Navigate to agent detail
            NotificationCenter.default.post(
                name: .pushNotificationTapped,
                object: nil,
                userInfo: ["agentId": agentId]
            )
        } else if let taskId = userInfo["taskId"] as? String {
            NotificationCenter.default.post(
                name: .pushNotificationTapped,
                object: nil,
                userInfo: ["taskId": taskId]
            )
        }
    }
}

extension Notification.Name {
    static let pushNotificationTapped = Notification.Name("pushNotificationTapped")
}
