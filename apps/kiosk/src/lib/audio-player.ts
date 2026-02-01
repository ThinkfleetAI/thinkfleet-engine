/**
 * Audio player for incoming PCM 16-bit LE 16kHz mono TTS audio.
 * Queues chunks and plays them seamlessly through AudioContext.
 */

export function createAudioPlayer() {
  const ctx = new AudioContext({ sampleRate: 16000 });
  let nextStartTime = 0;
  const queue: AudioBufferSourceNode[] = [];

  function enqueue(pcm: Int16Array) {
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const audioBuffer = ctx.createBuffer(1, pcm.length, 16000);
    const channelData = audioBuffer.getChannelData(0);

    // Int16 -> Float32
    for (let i = 0; i < pcm.length; i++) {
      channelData[i] = pcm[i] / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, nextStartTime);
    source.start(startAt);
    nextStartTime = startAt + audioBuffer.duration;

    queue.push(source);
    source.onended = () => {
      const idx = queue.indexOf(source);
      if (idx >= 0) queue.splice(idx, 1);
    };
  }

  function clear() {
    for (const src of queue) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    queue.length = 0;
    nextStartTime = 0;
  }

  return { enqueue, clear };
}
