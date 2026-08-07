import Avatar from "./Avatar.jsx";

// Wraps the DiceBear <Avatar> with an optional Simli video layer on top.
// The DiceBear avatar stays mounted underneath at all times — if Simli
// fails, is disabled, or hasn't connected yet, this just looks like the
// plain fallback avatar with no visible seam.
export default function InterviewerFace({
  jobId, accent, accentBg, speaking, size = 140,
  simliActive = false, simliConnecting = false,
  videoRef, audioSinkRef,
}) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{ opacity: simliActive ? 0 : 1, transition: "opacity 0.25s" }}>
        <Avatar jobId={jobId} accent={accent} accentBg={accentBg} speaking={speaking} size={size} />
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          opacity: simliActive ? 1 : 0,
          transition: "opacity 0.25s",
          pointerEvents: "none",
          boxShadow: simliActive ? `0 0 0 3px ${accent}66, 0 0 0 8px ${accent}22` : "none",
        }}
      />
      <audio ref={audioSinkRef} autoPlay style={{ display: "none" }} />
      {simliConnecting && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#00000022",
          }}
        >
          <span style={{
            width: 16, height: 16, border: "2px solid #ffffffaa", borderTopColor: "#fff",
            borderRadius: "50%", animation: "spin 0.7s linear infinite",
          }} />
        </div>
      )}
    </div>
  );
}
