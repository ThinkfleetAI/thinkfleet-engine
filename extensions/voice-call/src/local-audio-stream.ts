/**
 * Local Audio Stream Handler
 *
 * Handles bidirectional audio streaming between a local kiosk browser and the AI agent.
 * Unlike MediaStreamHandler (Twilio), this accepts PCM audio directly from Web Audio API.
 *
 * Audio formats:
 * - Inbound (browser → gateway): PCM 16-bit LE, 16kHz, mono
 * - Outbound (gateway → browser): PCM 16-bit LE, 16kHz, mono
 *
 * Protocol:
 * - Binary frames: raw audio data
 * - Text frames: JSON control messages
 */

import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

import { WebSocket, WebSocketServer } from "ws";

import type {
	OpenAIRealtimeSTTProvider,
	RealtimeSTTSession,
} from "./providers/stt-openai-realtime.js";
import { OpenAITTSProvider, type OpenAITTSConfig } from "./providers/tts-openai.js";
import { resamplePcmTo8k, pcmToMulaw } from "./telephony-audio.js";

/** Resample PCM 24kHz to 16kHz using linear interpolation. */
function resamplePcm24kTo16k(input: Buffer): Buffer {
	const inputSamples = Math.floor(input.length / 2);
	if (inputSamples === 0) return Buffer.alloc(0);

	const ratio = 24000 / 16000; // 1.5
	const outputSamples = Math.floor(inputSamples / ratio);
	const output = Buffer.alloc(outputSamples * 2);

	for (let i = 0; i < outputSamples; i++) {
		const srcPos = i * ratio;
		const srcIndex = Math.floor(srcPos);
		const frac = srcPos - srcIndex;

		const s0 = input.readInt16LE(srcIndex * 2);
		const s1Index = Math.min(srcIndex + 1, inputSamples - 1);
		const s1 = input.readInt16LE(s1Index * 2);

		const sample = Math.round(s0 + frac * (s1 - s0));
		output.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2);
	}

	return output;
}

/**
 * Convert PCM 16kHz 16-bit LE mono to mu-law 8kHz for OpenAI Realtime STT.
 */
function pcm16kToMulaw8k(pcm16k: Buffer): Buffer {
	const pcm8k = resamplePcmTo8k(pcm16k, 16000);
	return pcmToMulaw(pcm8k);
}

/** Control messages sent from kiosk to gateway. */
export type KioskInboundMessage =
	| { type: "session.start" }
	| { type: "session.end" };

/** Control messages sent from gateway to kiosk. */
export type KioskOutboundMessage =
	| { type: "session.ready"; sessionId: string }
	| { type: "transcript.partial"; text: string }
	| { type: "transcript.final"; text: string }
	| { type: "agent.speaking"; text: string }
	| { type: "agent.mood"; mood: string }
	| { type: "agent.content"; contentType: "url" | "receipt"; payload: unknown }
	| { type: "tts.start" }
	| { type: "tts.end" }
	| { type: "error"; message: string };

/**
 * Configuration for the local audio stream handler.
 */
export interface LocalAudioStreamConfig {
	/** STT provider for transcription (OpenAI Realtime) */
	sttProvider: OpenAIRealtimeSTTProvider;
	/** TTS provider configuration */
	ttsConfig: OpenAITTSConfig;
	/** Callback when a final transcript is received — should send to agent and return response text */
	onTranscript: (sessionId: string, transcript: string) => Promise<string>;
	/** Optional callback for mood changes */
	onMoodChange?: (sessionId: string, mood: string) => void;
}

/**
 * Active local audio session.
 */
interface LocalAudioSession {
	sessionId: string;
	ws: WebSocket;
	sttSession: RealtimeSTTSession;
	ttsProvider: OpenAITTSProvider;
	ttsPlaying: boolean;
	ttsAbortController: AbortController | null;
}

/**
 * Manages WebSocket connections for local kiosk audio streaming.
 */
export class LocalAudioStreamHandler {
	private wss: WebSocketServer | null = null;
	private sessions = new Map<string, LocalAudioSession>();
	private config: LocalAudioStreamConfig;

	constructor(config: LocalAudioStreamConfig) {
		this.config = config;
	}

	/**
	 * Handle WebSocket upgrade for local audio connections.
	 * Returns true if the upgrade was handled.
	 */
	handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean {
		const url = new URL(request.url || "/", "http://localhost");
		if (url.pathname !== "/ws/local-audio") return false;

		if (!this.wss) {
			this.wss = new WebSocketServer({ noServer: true });
			this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
		}

		this.wss.handleUpgrade(request, socket, head, (ws) => {
			this.wss?.emit("connection", ws, request);
		});
		return true;
	}

	/**
	 * Handle new WebSocket connection from kiosk browser.
	 */
	private async handleConnection(
		ws: WebSocket,
		_request: IncomingMessage,
	): Promise<void> {
		let session: LocalAudioSession | null = null;

		ws.on("message", async (data: Buffer | string, isBinary: boolean) => {
			try {
				if (isBinary || Buffer.isBuffer(data)) {
					// Binary frame = PCM audio from microphone
					if (session) {
						const pcmData = Buffer.isBuffer(data) ? data : Buffer.from(data);
						// Convert PCM 16kHz → mu-law 8kHz for OpenAI Realtime STT
						const mulaw = pcm16kToMulaw8k(pcmData);
						session.sttSession.sendAudio(mulaw);
					}
				} else {
					// Text frame = JSON control message
					const message = JSON.parse(
						typeof data === "string" ? data : data.toString(),
					) as KioskInboundMessage;

					switch (message.type) {
						case "session.start":
							if (session) {
								this.handleSessionEnd(session);
							}
							session = await this.handleSessionStart(ws);
							break;

						case "session.end":
							if (session) {
								this.handleSessionEnd(session);
								session = null;
							}
							break;
					}
				}
			} catch (error) {
				console.error("[LocalAudio] Error processing message:", error);
				this.sendControl(ws, {
					type: "error",
					message: error instanceof Error ? error.message : "Unknown error",
				});
			}
		});

		ws.on("close", () => {
			if (session) {
				this.handleSessionEnd(session);
			}
		});

		ws.on("error", (error) => {
			console.error("[LocalAudio] WebSocket error:", error);
		});

		// Auto-start session on connect
		session = await this.handleSessionStart(ws);
	}

	/**
	 * Start a new audio session.
	 */
	private async handleSessionStart(ws: WebSocket): Promise<LocalAudioSession> {
		const sessionId = randomUUID();
		console.log(`[LocalAudio] Session started: ${sessionId}`);

		const sttSession = this.config.sttProvider.createSession();
		const ttsProvider = new OpenAITTSProvider(this.config.ttsConfig);

		const session: LocalAudioSession = {
			sessionId,
			ws,
			sttSession,
			ttsProvider,
			ttsPlaying: false,
			ttsAbortController: null,
		};

		// Set up STT callbacks
		sttSession.onPartial((partial) => {
			this.sendControl(ws, { type: "transcript.partial", text: partial });
		});

		sttSession.onTranscript((transcript) => {
			this.sendControl(ws, { type: "transcript.final", text: transcript });
			this.sendControl(ws, { type: "agent.mood", mood: "thinking" });

			// Process through agent and generate TTS response
			void this.processTranscript(session, transcript);
		});

		sttSession.onSpeechStart(() => {
			// Barge-in: cancel any TTS playback
			if (session.ttsAbortController) {
				session.ttsAbortController.abort();
				session.ttsAbortController = null;
			}
			this.sendControl(ws, { type: "agent.mood", mood: "idle" });
		});

		this.sessions.set(sessionId, session);

		// Send ready event
		this.sendControl(ws, { type: "session.ready", sessionId });

		// Connect to STT (non-blocking)
		sttSession.connect().catch((err) => {
			console.warn(
				`[LocalAudio] STT connection failed:`,
				err instanceof Error ? err.message : String(err),
			);
			this.sendControl(ws, {
				type: "error",
				message: "Speech recognition connection failed",
			});
		});

		return session;
	}

	/**
	 * Process a completed transcript: send to agent, get response, TTS it back.
	 */
	private async processTranscript(
		session: LocalAudioSession,
		transcript: string,
	): Promise<void> {
		if (!transcript.trim()) return;

		try {
			// Get agent response
			const responseText = await this.config.onTranscript(
				session.sessionId,
				transcript,
			);

			if (!responseText.trim()) return;

			// Notify kiosk what the agent is saying
			this.sendControl(session.ws, {
				type: "agent.speaking",
				text: responseText,
			});
			this.sendControl(session.ws, { type: "agent.mood", mood: "working" });

			// Generate TTS and stream to browser
			await this.synthesizeAndSend(session, responseText);

			this.sendControl(session.ws, { type: "agent.mood", mood: "idle" });
		} catch (error) {
			console.error("[LocalAudio] Error processing transcript:", error);
			this.sendControl(session.ws, {
				type: "error",
				message: error instanceof Error ? error.message : "Processing error",
			});
			this.sendControl(session.ws, { type: "agent.mood", mood: "error" });
		}
	}

	/**
	 * Synthesize text to speech and stream PCM audio to the kiosk browser.
	 */
	private async synthesizeAndSend(
		session: LocalAudioSession,
		text: string,
	): Promise<void> {
		const controller = new AbortController();
		session.ttsAbortController = controller;
		session.ttsPlaying = true;

		this.sendControl(session.ws, { type: "tts.start" });

		try {
			// Get PCM 24kHz from OpenAI TTS
			const pcm24k = await session.ttsProvider.synthesize(text);

			if (controller.signal.aborted) return;

			// Resample to 16kHz for browser playback
			const pcm16k = resamplePcm24kTo16k(pcm24k);

			if (controller.signal.aborted) return;

			// Send as binary frames, chunked for smooth streaming
			// 16kHz * 2 bytes * 20ms = 640 bytes per chunk
			const CHUNK_SIZE = 640;
			for (let i = 0; i < pcm16k.length; i += CHUNK_SIZE) {
				if (controller.signal.aborted) break;
				if (session.ws.readyState !== WebSocket.OPEN) break;

				const chunk = pcm16k.subarray(i, Math.min(i + CHUNK_SIZE, pcm16k.length));
				session.ws.send(chunk);

				// Small delay between chunks to simulate streaming (~20ms per chunk)
				if (i + CHUNK_SIZE < pcm16k.length) {
					await new Promise((resolve) => setTimeout(resolve, 18));
				}
			}
		} finally {
			session.ttsPlaying = false;
			session.ttsAbortController = null;
			if (session.ws.readyState === WebSocket.OPEN) {
				this.sendControl(session.ws, { type: "tts.end" });
			}
		}
	}

	/**
	 * End a session and clean up.
	 */
	private handleSessionEnd(session: LocalAudioSession): void {
		console.log(`[LocalAudio] Session ended: ${session.sessionId}`);

		if (session.ttsAbortController) {
			session.ttsAbortController.abort();
		}
		session.sttSession.close();
		this.sessions.delete(session.sessionId);
	}

	/**
	 * Send a JSON control message to the kiosk.
	 */
	private sendControl(ws: WebSocket, message: KioskOutboundMessage): void {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
		}
	}

	/**
	 * Close all active sessions.
	 */
	closeAll(): void {
		for (const session of this.sessions.values()) {
			if (session.ttsAbortController) {
				session.ttsAbortController.abort();
			}
			session.sttSession.close();
			session.ws.close();
		}
		this.sessions.clear();
	}

	/**
	 * Send a mood change to all active sessions (for external triggers).
	 */
	broadcastMood(mood: string): void {
		for (const session of this.sessions.values()) {
			this.sendControl(session.ws, { type: "agent.mood", mood });
		}
	}

	/**
	 * Send content overlay to all active sessions.
	 */
	broadcastContent(contentType: "url" | "receipt", payload: unknown): void {
		for (const session of this.sessions.values()) {
			this.sendControl(session.ws, { type: "agent.content", contentType, payload });
		}
	}

	/**
	 * Get number of active sessions.
	 */
	get sessionCount(): number {
		return this.sessions.size;
	}
}
