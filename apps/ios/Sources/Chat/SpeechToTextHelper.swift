import AVFAudio
import Foundation
import Speech

@MainActor
@Observable
final class SpeechToTextHelper {
    var isListening = false
    var transcript = ""
    var error: String?

    private var audioEngine: AVAudioEngine?
    private var speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    func toggleListening() {
        if isListening {
            stopListening()
        } else {
            Task { await startListening() }
        }
    }

    func startListening() async {
        guard !isListening else { return }
        error = nil
        transcript = ""

        // Request microphone permission first (missing this caused the crash)
        let micOk = await Self.requestMicrophonePermission()
        guard micOk else {
            error = "Microphone access not authorized"
            return
        }

        // Request speech recognition permission
        let speechOk = await Self.requestSpeechPermission()
        guard speechOk else {
            error = "Speech recognition not authorized"
            return
        }

        do {
            try Self.configureAudioSession()
            try startRecognition()
            isListening = true
        } catch {
            self.error = "Could not start: \(error.localizedDescription)"
        }
    }

    func stopListening() {
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        if let engine = audioEngine {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
        }
        audioEngine = nil
        speechRecognizer = nil
        isListening = false
        transcript = ""
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            // Ignore deactivation errors
        }
    }

    private func startRecognition() throws {
        #if targetEnvironment(simulator)
        throw NSError(domain: "SpeechToText", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Speech recognition is not supported on the simulator",
        ])
        #endif

        speechRecognizer = SFSpeechRecognizer()
        guard speechRecognizer != nil else {
            throw NSError(domain: "SpeechToText", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Speech recognizer unavailable",
            ])
        }

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        recognitionRequest?.shouldReportPartialResults = true
        guard let request = recognitionRequest else { return }

        let engine = AVAudioEngine()
        self.audioEngine = engine

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            throw NSError(domain: "SpeechToText", code: 3, userInfo: [
                NSLocalizedDescriptionKey: "Invalid audio input format",
            ])
        }
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 2048, format: format) { buffer, _ in
            request.append(buffer)
        }

        engine.prepare()
        try engine.start()

        recognitionTask = speechRecognizer!.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            if let error {
                Task { @MainActor in
                    self.error = error.localizedDescription
                    self.stopListening()
                }
                return
            }
            guard let result else { return }
            let text = result.bestTranscription.formattedString
            Task { @MainActor in
                self.transcript = text
            }
        }
    }

    private nonisolated static func requestMicrophonePermission() async -> Bool {
        await withCheckedContinuation(isolation: nil) { cont in
            AVAudioApplication.requestRecordPermission { ok in
                cont.resume(returning: ok)
            }
        }
    }

    private nonisolated static func requestSpeechPermission() async -> Bool {
        await withCheckedContinuation(isolation: nil) { cont in
            SFSpeechRecognizer.requestAuthorization { status in
                cont.resume(returning: status == .authorized)
            }
        }
    }

    private static func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [
            .defaultToSpeaker,
            .allowBluetoothHFP,
        ])
        try session.setActive(true, options: [])
    }
}
