import { useEffect, useRef } from "react";
import { amplitudeRef } from "./audioLevel.js";

// Replaces the illustrated avatar with an abstract voice indicator — bars
// that react to actual speech amplitude while speaking, and a slow idle
// "breathing" pulse otherwise. No face, so no uncanny-valley risk; research
// on synthetic interviewer avatars consistently finds non-photoreal faces
// read worse than no face at all, while a waveform reads as "a real voice"
// without pretending to be a person.
const BAR_COUNT = 5;
// Per-bar phase offsets so bars move independently instead of in lockstep —
// reads as a real waveform rather than one pulsing block.
const PHASES = [0, 1.3, 2.6, 0.7, 1.9];

export default function VoiceWaveform({ accent, accentBg, speaking, size = 72 }) {
  const barRefs = useRef([]);

  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / 1000;
      const a = amplitudeRef.current;
      barRefs.current.forEach((el, i) => {
        if (!el) return;
        let h;
        if (speaking) {
          // Blend live amplitude with a per-bar sine wave so bars vary
          // independently instead of pulsing in lockstep with each other.
          const wave = 0.5 + 0.5 * Math.sin(t * 6 + PHASES[i]);
          h = 0.16 + Math.min(1, a * 1.6) * (0.35 + 0.65 * wave);
        } else {
          // Idle: slow, small, staggered so it reads as "listening," not dead.
          h = 0.14 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.9 + PHASES[i]));
        }
        el.style.transform = `scaleY(${Math.max(0.08, Math.min(1, h))})`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  const barWidth = Math.max(3, Math.round(size * 0.06));
  const gap = Math.max(3, Math.round(size * 0.055));

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: accentBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap,
        boxShadow: speaking
          ? `0 0 0 3px ${accent}55, 0 0 0 8px ${accent}22`
          : `0 0 0 1px ${accent}22`,
        transition: "box-shadow 0.35s",
        flexShrink: 0,
      }}
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <span
          key={i}
          ref={(el) => (barRefs.current[i] = el)}
          style={{
            width: barWidth,
            height: size * 0.62,
            borderRadius: barWidth,
            background: accent,
            transform: "scaleY(0.14)",
            transformOrigin: "50% 50%",
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}
