import AppIntents

struct ThinkFleetShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskAgentIntent(),
            phrases: [
                "Ask \(.applicationName) agent \(\.$agent)",
                "Ask my \(.applicationName) agent",
                "Send a message to my \(.applicationName) agent",
            ],
            shortTitle: "Ask Agent",
            systemImageName: "bubble.left.and.text.bubble.right"
        )

        AppShortcut(
            intent: CheckAgentStatusIntent(),
            phrases: [
                "Check \(.applicationName) agent status",
                "What is my \(.applicationName) agent doing",
                "Is my \(.applicationName) agent running",
            ],
            shortTitle: "Agent Status",
            systemImageName: "cpu"
        )

        AppShortcut(
            intent: ListAgentsIntent(),
            phrases: [
                "List my \(.applicationName) agents",
                "Show my \(.applicationName) agents",
                "How many \(.applicationName) agents do I have",
            ],
            shortTitle: "List Agents",
            systemImageName: "list.bullet"
        )
    }
}
