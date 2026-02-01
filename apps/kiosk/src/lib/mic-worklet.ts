/**
 * Mic capture using AudioWorklet.
 * Captures at 16kHz, outputs Int16 PCM chunks (~20ms = 320 samples).
 */

const WORKLET_CODE = `
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    // Accumulate samples
    const prev = this._buffer;
    const combined = new Float32Array(prev.length + input.length);
    combined.set(prev);
    combined.set(input, prev.length);
    this._buffer = combined;

    // Emit 320-sample chunks (20ms at 16kHz)
    while (this._buffer.length >= 320) {
      const chunk = this._buffer.slice(0, 320);
      this._buffer = this._buffer.slice(320);

      // Float32 -> Int16
      const pcm = new Int16Array(320);
      for (let i = 0; i < 320; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}
registerProcessor('mic-processor', MicProcessor);
`;

export async function createMicCapture(
  onChunk: (pcm: Int16Array) => void,
): Promise<{ stop: () => void }> {
  const ctx = new AudioContext({ sampleRate: 16000 });

  // Register worklet from blob
  const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const source = ctx.createMediaStreamSource(stream);
  const workletNode = new AudioWorkletNode(ctx, "mic-processor");

  workletNode.port.onmessage = (ev) => {
    onChunk(new Int16Array(ev.data));
  };

  source.connect(workletNode);
  // Don't connect to destination (no feedback loop)

  return {
    stop() {
      workletNode.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
    },
  };
}
