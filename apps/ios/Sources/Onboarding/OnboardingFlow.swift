import SwiftUI

struct OnboardingFlow: View {
    @Environment(AppState.self) private var appState
    @State private var currentStep = 0

    private let steps: [OnboardingStep] = [
        OnboardingStep(
            icon: "bolt.shield.fill",
            title: "Welcome to ThinkFleet",
            description: "Your AI agent management platform. Create, deploy, and manage intelligent agents from your mobile device."
        ),
        OnboardingStep(
            icon: "cpu",
            title: "Create Agents",
            description: "Set up AI agents with custom personas, connect them to messaging channels like WhatsApp, Telegram, and Discord."
        ),
        OnboardingStep(
            icon: "checklist",
            title: "Manage Tasks",
            description: "Organize work with task boards, assign tasks to agents, and track progress in real time."
        ),
        OnboardingStep(
            icon: "key.fill",
            title: "Secure Credentials",
            description: "Securely store API keys for AI providers like Anthropic, OpenAI, and more. All encrypted at rest."
        ),
    ]

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $currentStep) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    VStack(spacing: 24) {
                        Spacer()

                        Image(systemName: step.icon)
                            .font(.system(size: 72))
                            .foregroundStyle(.tint)

                        Text(step.title)
                            .font(.title.bold())
                            .multilineTextAlignment(.center)

                        Text(step.description)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)

                        Spacer()
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))

            // Bottom actions
            VStack(spacing: 12) {
                if currentStep == steps.count - 1 {
                    Button {
                        Task { await completeOnboarding() }
                    } label: {
                        Text("Get Started")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                } else {
                    Button {
                        withAnimation { currentStep += 1 }
                    } label: {
                        Text("Next")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)

                    Button("Skip") {
                        Task { await completeOnboarding() }
                    }
                    .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
    }

    private func completeOnboarding() async {
        struct Input: Codable { let onboardingComplete: Bool }
        struct Response: Codable { let success: Bool? }
        _ = try? await appState.apiClient.rpc(
            "users.updateProfile", input: Input(onboardingComplete: true)
        ) as Response
    }
}

private struct OnboardingStep {
    let icon: String
    let title: String
    let description: String
}
