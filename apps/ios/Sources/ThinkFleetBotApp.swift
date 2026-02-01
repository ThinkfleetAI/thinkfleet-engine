import SwiftUI
import UIKit

@main
struct ThinkFleetApp: App {
    @UIApplicationDelegateAdaptor(ThinkFleetAppDelegate.self) private var appDelegate
    @State private var appState: AppState
    @State private var appModel: NodeAppModel
    @State private var gatewayController: GatewayConnectionController
    @Environment(\.scenePhase) private var scenePhase

    init() {
        GatewaySettingsStore.bootstrapPersistence()
        let appModel = NodeAppModel()
        _appModel = State(initialValue: appModel)
        _gatewayController = State(initialValue: GatewayConnectionController(appModel: appModel))
        _appState = State(initialValue: AppState())
    }

    var body: some Scene {
        WindowGroup {
            AuthGateView {
                MainTabView()
            }
            .environment(self.appState)
            .environment(self.appModel)
            .environment(self.appModel.voiceWake)
            .environment(self.gatewayController)
            .onOpenURL { url in
                Task { await self.appModel.handleDeepLink(url: url) }
            }
            .onChange(of: self.scenePhase) { _, newValue in
                self.appModel.setScenePhase(newValue)
                self.gatewayController.setScenePhase(newValue)
            }
            .onAppear {
                appDelegate.pushManager.configure(appState: appState)
            }
        }
    }
}

class ThinkFleetAppDelegate: NSObject, UIApplicationDelegate {
    let pushManager = PushNotificationManager()

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        pushManager.didRegisterForRemoteNotifications(deviceToken: deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        pushManager.didFailToRegisterForRemoteNotifications(error: error)
    }
}
