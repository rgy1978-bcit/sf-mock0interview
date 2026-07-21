import { useEffect, useRef, useState } from "react";
import avatarSarah from "./assets/avatar-sarah.svg";
import avatarMarcus from "./assets/avatar-marcus.svg";
import avatarJennifer from "./assets/avatar-jennifer.svg";
import avatarDavid from "./assets/avatar-david.svg";
import { amplitudeRef } from "./lipsync.js";

// Interviewer identities repeat across some jobs (Jennifer covers both parks
// & rec jobs; David covers both aquatics jobs), so we key on person, not job.
const ART_BY_JOB = {
  canes:   avatarSarah,
  petplus: avatarMarcus,
  sfcamp:  avatarJennifer,
  sfpark:  avatarJennifer,
  swim:    avatarDavid,
  guard:   avatarDavid,
  // Person keys for cross-branch compatibility.
  sarah:    avatarSarah,
  marcus:   avatarMarcus,
  jennifer: avatarJennifer,
  david:    avatarDavid,
};

// Blink every ~3–5 s. Runs whether speaking or idle.
function useBlink() {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let stop = false;
    let t1, t2;
    const loop = () => {
      const delay = 2800 + Math.random() * 2200;
      t1 = setTimeout(() => {
        if (stop) return;
        setBlink(true);
        t2 = setTimeout(() => { if (!stop) { setBlink(false); loop(); } }, 140);
      }, delay);
    };
    loop();
    return () => { stop = true; clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return blink;
}

export default function Avatar({ jobId, accent, accentBg, speaking, size = 140 }) {
  const src = ART_BY_JOB[jobId] || avatarSarah;
  const imgRef = useRef(null);
  const mouthRef = useRef(null);
  const blink = useBlink();

  // While speaking, sample amplitudeRef at 60 fps and drive:
  //   - a subtle whole-face scale + downward translate (jaw-drop illusion),
  //   - the height of the "speech" ellipse overlaid on the character's mouth.
  useEffect(() => {
    if (!speaking) {
      if (imgRef.current) imgRef.current.style.transform = "";
      if (mouthRef.current) mouthRef.current.style.transform = "scaleY(0)";
      return;
    }
    let raf;
    const tick = () => {
      const a = amplitudeRef.current;
      if (imgRef.current) {
        const scale = 1 + a * 0.025;
        const ty = a * 0.6;
        imgRef.current.style.transform = `scale(${scale}) translateY(${ty}px)`;
      }
      if (mouthRef.current) {
        const h = Math.min(1, a * 1.8);
        mouthRef.current.style.transform = `translateX(-50%) scaleY(${h})`;
        mouthRef.current.style.opacity = String(0.55 * Math.min(1, a * 3));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  // Rough mouth position for the DiceBear personas illustration. The face is
  // centred; the mouth sits ~64% down the SVG. These constants are tuned to
  // land on top of the drawn mouth without covering the character's smile
  // outline.
  const mouthTopPct = 66;
  const mouthMaxW = size * 0.19;
  const mouthMaxH = size * 0.055;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        background: accentBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: speaking
          ? `0 0 0 3px ${accent}66, 0 0 0 8px ${accent}22`
          : `0 0 0 1px ${accent}22`,
        transition: "box-shadow 0.35s",
        overflow: "hidden",
        flexShrink: 0,
        animation: speaking ? "none" : "avatarBreath 4s ease-in-out infinite",
      }}
    >
      <img
        ref={imgRef}
        src={src}
        alt=""
        width={size}
        height={size}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
          transition: speaking ? "none" : "transform 0.3s",
          willChange: speaking ? "transform" : "auto",
        }}
      />

      {/* Blink overlay: two thin bars flick over the drawn eyes. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: `${size * 0.40}px`,
          left: `${size * 0.28}px`,
          width: `${size * 0.10}px`,
          height: "2px",
          background: "#3a2e28",
          borderRadius: "2px",
          opacity: blink ? 0.9 : 0,
          transition: "opacity 60ms ease-out",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: `${size * 0.40}px`,
          right: `${size * 0.28}px`,
          width: `${size * 0.10}px`,
          height: "2px",
          background: "#3a2e28",
          borderRadius: "2px",
          opacity: blink ? 0.9 : 0,
          transition: "opacity 60ms ease-out",
          pointerEvents: "none",
        }}
      />

      {/* Amplitude-driven mouth overlay. scaleY starts at 0 (closed) and
          grows with amplitude. Origin at top so it opens downward. */}
      <span
        ref={mouthRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          top: `${mouthTopPct}%`,
          left: "50%",
          width: `${mouthMaxW}px`,
          height: `${mouthMaxH}px`,
          background: "#3a1a1a",
          borderRadius: "50%",
          transform: "translateX(-50%) scaleY(0)",
          transformOrigin: "50% 0%",
          opacity: 0,
          pointerEvents: "none",
          boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.15)",
        }}
      />
    </div>
  );
}
