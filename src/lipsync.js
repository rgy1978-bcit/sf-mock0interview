// Real-time amplitude sampler shared between speakText() and <Avatar>.
// One AudioContext for the whole app, one MediaElementSource per <audio>
// (that's a hard browser rule — one source per element).
//
// The current amplitude sits at amplitudeRef.current, in [0, 1]. Avatar reads
// it from its own rAF loop and drives a subtle scale/translate on the SVG.
// No React state → no re-renders, no re-render storms at 60 fps.

let audioCtx = null;
let currentSource = null;
let currentAnalyser = null;
let rafId = null;

export const amplitudeRef = { current: 0 };

function ensureCtx() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

export function attachLipSync(audioElement) {
  detachLipSync();
  const ctx = ensureCtx();
  if (!ctx || !audioElement) return;
  try {
    const source = ctx.createMediaElementSource(audioElement);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.55;
    source.connect(analyser);
    // Also connect to destination so the audio remains audible — grabbing
    // the source silences the element otherwise.
    source.connect(ctx.destination);
    currentSource = source;
    currentAnalyser = analyser;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      // Weight lower-mid frequencies where speech energy lives (~150–2 kHz).
      let sum = 0;
      const lo = 2;
      const hi = Math.min(48, buf.length);
      for (let i = lo; i < hi; i++) sum += buf[i];
      const avg = sum / (hi - lo) / 255;
      amplitudeRef.current = Math.min(1, Math.max(0, avg * 2.2));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  } catch (e) {
    // createMediaElementSource throws if called twice on the same element,
    // and some older browsers don't expose the constructor. Fail quietly and
    // let the avatar fall back to the idle-breathing animation.
    console.warn("lipsync attach failed", e);
  }
}

export function detachLipSync() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (currentSource) { try { currentSource.disconnect(); } catch {} currentSource = null; }
  if (currentAnalyser) { try { currentAnalyser.disconnect(); } catch {} currentAnalyser = null; }
  amplitudeRef.current = 0;
}
