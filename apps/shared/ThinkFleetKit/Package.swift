// swift-tools-version: 6.1

import PackageDescription

let package = Package(
    name: "ThinkFleetKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "ThinkFleetProtocol", targets: ["ThinkFleetProtocol"]),
        .library(name: "ThinkFleetKit", targets: ["ThinkFleetKit"]),
        .library(name: "ThinkFleetChatUI", targets: ["ThinkFleetChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "ThinkFleetProtocol",
            path: "Sources/ThinkFleetProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "ThinkFleetKit",
            dependencies: [
                "ThinkFleetProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/ThinkFleetKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "ThinkFleetChatUI",
            dependencies: [
                "ThinkFleetKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/ThinkFleetChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "ThinkFleetKitTests",
            dependencies: ["ThinkFleetKit", "ThinkFleetChatUI"],
            path: "Tests/ThinkFleetKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
