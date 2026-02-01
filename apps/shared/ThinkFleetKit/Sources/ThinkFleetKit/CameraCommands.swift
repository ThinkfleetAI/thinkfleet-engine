import Foundation

public enum ThinkFleetBotCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum ThinkFleetBotCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum ThinkFleetBotCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum ThinkFleetBotCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct ThinkFleetBotCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: ThinkFleetBotCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: ThinkFleetBotCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: ThinkFleetBotCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: ThinkFleetBotCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct ThinkFleetBotCameraClipParams: Codable, Sendable, Equatable {
    public var facing: ThinkFleetBotCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: ThinkFleetBotCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: ThinkFleetBotCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: ThinkFleetBotCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
