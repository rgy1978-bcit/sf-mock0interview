// Client-side Simli connection lifecycle. Mirrors the shape of lipsync.js:
// one module-level "current connection" so callers don't have to juggle
// cleanup themselves.
//
// Reconnect-per-question by design. Simli's session config (maxSessionLength,
// maxIdleTime) implies billing tracks connected time, not audio actually
// sent — so we open a session right before an interviewer utterance and
// close it right after, rather than holding one connection open for an
// entire ~10 minute interview (most of which is silent recording/thinking
// time). This keeps paid Simli minutes close to actual talk time.
//
// simli-client pulls in livekit-client (a WebRTC SFU client), which adds
// ~150KB gzipped — imported dynamically below so that weight is only
// downloaded the first time a Simli connection is actually attempted, not
// on every page load. When VITE_PREMIA_USE_SIMLI is off, or a session never
// reaches the interview screen, this chunk never loads at all.

export const SIMLI_ENABLED = import.meta.env.VITE_PREMIA_USE_SIMLI === "1";

let activeClient = null;

// videoElement/audioElement are the sinks Simli writes its returned WebRTC
// tracks into — NOT the source of our TTS audio. sourceAudioElement is our
// existing Azure TTS <audio> element; calling listenToAudioElement() on it
// reroutes its output into the Web Audio graph, which (per the SDK) also
// silences its direct output — so only Simli's synced video+audio track
// plays out loud, with no doubled audio.
export async function connectSimli({ faceId, videoElement, audioElement, sourceAudioElement }) {
  await disconnectSimli();
  if (!videoElement || !audioElement || !sourceAudioElement) {
    throw new Error("Simli connect called before elements were mounted");
  }

  const res = await fetch("/api/simli-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ faceId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Simli token error ${res.status}`);
  }
  const { session_token } = await res.json();
  if (!session_token) throw new Error("Simli did not return a session token");

  const { SimliClient, LogLevel } = await import("simli-client");
  const client = new SimliClient(
    session_token,
    videoElement,
    audioElement,
    null,           // iceServers: not needed on the livekit transport
    LogLevel.ERROR, // quiet unless something actually breaks
    "livekit",
  );

  activeClient = client;
  await client.start();
  // Only attach once the connection is live — the worklet posts samples to
  // the signaling connection immediately, which needs to exist already.
  client.listenToAudioElement(sourceAudioElement);
  return client;
}

export async function disconnectSimli() {
  const client = activeClient;
  activeClient = null;
  if (client) {
    try { await client.stop(); } catch { /* already gone */ }
  }
}
