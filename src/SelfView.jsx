import { useEffect, useRef, useState } from "react";

export default function SelfView({ accent }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setErr(e.name === "NotAllowedError" ? "Camera blocked" : "Camera unavailable");
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div
      aria-label="Your camera preview"
      style={{
        position: "relative",
        width: 132, height: 100,
        borderRadius: 10,
        overflow: "hidden",
        background: "#111",
        border: `1px solid ${accent}55`,
        flexShrink: 0,
      }}
    >
      {err ? (
        <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#e5e7eb", fontSize: 11, textAlign: "center", padding: 8 }}>
          {err}
        </div>
      ) : (
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
        />
      )}
      <div style={{
        position: "absolute", bottom: 4, left: 6,
        fontSize: 10, color: "#fff", background: "#0006",
        padding: "1px 5px", borderRadius: 4, letterSpacing: 0.3,
      }}>You</div>
    </div>
  );
}
