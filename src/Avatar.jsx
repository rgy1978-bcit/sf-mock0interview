import { useEffect, useRef, useState } from "react";

// Six per-interviewer looks, keyed off the JOBS ids in App.jsx.
// Skin + hair kept small on purpose — the goal is a recognizable face for
// eye contact, not photorealism.
const LOOKS = {
  canes:   { skin: "#F1C79A", hair: "#4A2C13", hairStyle: "wavy",   collarLight: "#FFF4D6" },
  petplus: { skin: "#E4B085", hair: "#1E1E1E", hairStyle: "short",  collarLight: "#F9E1CE" },
  sfcamp:  { skin: "#E9C0A0", hair: "#7A4A22", hairStyle: "pony",   collarLight: "#E8F5E9" },
  sfpark:  { skin: "#D9A579", hair: "#3B1F0E", hairStyle: "pony",   collarLight: "#E3EFFB" },
  swim:    { skin: "#C9884E", hair: "#111111", hairStyle: "short",  collarLight: "#E1F0FA" },
  guard:   { skin: "#D9A277", hair: "#2C1810", hairStyle: "short",  collarLight: "#FBE2E2" },
};

const DEFAULT_LOOK = { skin: "#E4B085", hair: "#3B1F0E", hairStyle: "short", collarLight: "#f3f4f6" };

// Approximates a mouth opening amplitude by mixing time-based syllable
// pattern with random jitter. Not phoneme-accurate, but reads as talking.
function useMouthOpen(speaking) {
  const [open, setOpen] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  useEffect(() => {
    if (!speaking) { setOpen(0); return; }
    startRef.current = performance.now();
    const tick = (now) => {
      const t = (now - startRef.current) / 1000;
      // Two overlapping sine waves at speech-like rates, plus small jitter.
      const base = 0.55 + 0.35 * Math.sin(t * 9.2) + 0.15 * Math.sin(t * 15.7 + 1.3);
      const jitter = (Math.random() - 0.5) * 0.15;
      const v = Math.max(0, Math.min(1, base * 0.55 + jitter + 0.15));
      setOpen(v);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [speaking]);
  return open;
}

// Blink every 3–5 s.
function useBlink() {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let stop = false;
    const loop = () => {
      const delay = 2800 + Math.random() * 2200;
      setTimeout(() => {
        if (stop) return;
        setBlink(true);
        setTimeout(() => { if (!stop) { setBlink(false); loop(); } }, 130);
      }, delay);
    };
    loop();
    return () => { stop = true; };
  }, []);
  return blink;
}

// Track pointer for pupils to follow. Falls back to center gaze.
function usePupilTarget(containerRef) {
  const [t, setT] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (window.innerWidth / 2);
      const dy = (e.clientY - cy) / (window.innerHeight / 2);
      setT({ x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [containerRef]);
  return t;
}

export default function Avatar({ jobId, accent, accentBg, speaking, size = 140 }) {
  const look = LOOKS[jobId] || DEFAULT_LOOK;
  const wrapRef = useRef(null);
  const mouth = useMouthOpen(speaking);
  const blink = useBlink();
  const gaze = usePupilTarget(wrapRef);

  const pupilDX = gaze.x * 3.5;
  const pupilDY = gaze.y * 2.5;
  const mouthH = 2 + mouth * 10;
  const mouthW = 18 + mouth * 4;

  const hair =
    look.hairStyle === "pony" ? (
      <g fill={look.hair}>
        <path d="M32 46 Q50 20 68 46 L70 60 Q50 50 30 60 Z" />
        <ellipse cx="76" cy="62" rx="6" ry="14" />
      </g>
    ) : look.hairStyle === "wavy" ? (
      <path d="M28 52 Q34 24 50 22 Q66 24 72 52 Q60 44 50 44 Q40 44 28 52 Z" fill={look.hair} />
    ) : (
      <path d="M30 50 Q34 26 50 24 Q66 26 70 50 Q60 44 50 44 Q40 44 30 50 Z" fill={look.hair} />
    );

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%",
        background: `radial-gradient(circle at 50% 40%, ${accentBg} 0%, #fff 80%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: speaking ? `0 0 0 3px ${accent}55, 0 0 0 8px ${accent}22` : `0 0 0 1px ${accent}22`,
        transition: "box-shadow 0.3s",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 100 100" width={size * 0.9} height={size * 0.9}>
        <ellipse cx="50" cy="88" rx="30" ry="14" fill={accent} />
        <path d="M35 78 Q50 68 65 78 L65 90 L35 90 Z" fill="#fff" />
        <path d="M43 78 Q50 74 57 78 L57 84 L43 84 Z" fill={look.collarLight} />
        <ellipse cx="50" cy="54" rx="18" ry="22" fill={look.skin} />
        <ellipse cx="35" cy="58" rx="3" ry="4" fill={look.skin} />
        <ellipse cx="65" cy="58" rx="3" ry="4" fill={look.skin} />
        {hair}
        <g>
          {blink ? (
            <>
              <line x1="40" y1="55" x2="46" y2="55" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="54" y1="55" x2="60" y2="55" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
            </>
          ) : (
            <>
              <ellipse cx="43" cy="55" rx="2.6" ry="3" fill="#fff" stroke="#333" strokeWidth="0.5" />
              <ellipse cx="57" cy="55" rx="2.6" ry="3" fill="#fff" stroke="#333" strokeWidth="0.5" />
              <circle cx={43 + pupilDX} cy={55 + pupilDY} r="1.4" fill="#1a1a1a" />
              <circle cx={57 + pupilDX} cy={55 + pupilDY} r="1.4" fill="#1a1a1a" />
              <circle cx={43 + pupilDX + 0.5} cy={54 + pupilDY} r="0.4" fill="#fff" />
              <circle cx={57 + pupilDX + 0.5} cy={54 + pupilDY} r="0.4" fill="#fff" />
            </>
          )}
        </g>
        <path d="M40 51 Q43 48 46 51" stroke={look.hair} strokeWidth="0.9" fill="none" strokeLinecap="round" />
        <path d="M54 51 Q57 48 60 51" stroke={look.hair} strokeWidth="0.9" fill="none" strokeLinecap="round" />
        <path d="M49 61 Q50 63 51 61" stroke={look.hair} strokeWidth="0.7" fill="none" strokeLinecap="round" opacity="0.6" />
        <ellipse cx="50" cy={68 + (1 - mouth) * 1} rx={mouthW / 2} ry={mouthH / 2} fill="#5a2a2a" />
        <ellipse cx="50" cy={68 - mouthH / 2 + 0.6} rx={mouthW / 2 - 1} ry="0.8" fill="#B5525A" opacity="0.7" />
      </svg>
    </div>
  );
}
