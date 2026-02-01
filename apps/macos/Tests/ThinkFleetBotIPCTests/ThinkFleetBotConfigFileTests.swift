import Foundation
import Testing
@testable import ThinkFleetBot

@Suite(.serialized)
struct ThinkFleetBotConfigFileTests {
    @Test
    func configPathRespectsEnvOverride() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("thinkfleetbot-config-\(UUID().uuidString)")
            .appendingPathComponent("thinkfleetbot.json")
            .path

        await TestIsolation.withEnvValues(["THINKFLEETBOT_CONFIG_PATH": override]) {
            #expect(ThinkFleetBotConfigFile.url().path == override)
        }
    }

    @MainActor
    @Test
    func remoteGatewayPortParsesAndMatchesHost() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("thinkfleetbot-config-\(UUID().uuidString)")
            .appendingPathComponent("thinkfleetbot.json")
            .path

        await TestIsolation.withEnvValues(["THINKFLEETBOT_CONFIG_PATH": override]) {
            ThinkFleetBotConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "ws://gateway.ts.net:19999",
                    ],
                ],
            ])
            #expect(ThinkFleetBotConfigFile.remoteGatewayPort() == 19999)
            #expect(ThinkFleetBotConfigFile.remoteGatewayPort(matchingHost: "gateway.ts.net") == 19999)
            #expect(ThinkFleetBotConfigFile.remoteGatewayPort(matchingHost: "gateway") == 19999)
            #expect(ThinkFleetBotConfigFile.remoteGatewayPort(matchingHost: "other.ts.net") == nil)
        }
    }

    @MainActor
    @Test
    func setRemoteGatewayUrlPreservesScheme() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("thinkfleetbot-config-\(UUID().uuidString)")
            .appendingPathComponent("thinkfleetbot.json")
            .path

        await TestIsolation.withEnvValues(["THINKFLEETBOT_CONFIG_PATH": override]) {
            ThinkFleetBotConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "wss://old-host:111",
                    ],
                ],
            ])
            ThinkFleetBotConfigFile.setRemoteGatewayUrl(host: "new-host", port: 2222)
            let root = ThinkFleetBotConfigFile.loadDict()
            let url = ((root["gateway"] as? [String: Any])?["remote"] as? [String: Any])?["url"] as? String
            #expect(url == "wss://new-host:2222")
        }
    }

    @Test
    func stateDirOverrideSetsConfigPath() async {
        let dir = FileManager().temporaryDirectory
            .appendingPathComponent("thinkfleetbot-state-\(UUID().uuidString)", isDirectory: true)
            .path

        await TestIsolation.withEnvValues([
            "THINKFLEETBOT_CONFIG_PATH": nil,
            "THINKFLEETBOT_STATE_DIR": dir,
        ]) {
            #expect(ThinkFleetBotConfigFile.stateDirURL().path == dir)
            #expect(ThinkFleetBotConfigFile.url().path == "\(dir)/thinkfleetbot.json")
        }
    }
}
