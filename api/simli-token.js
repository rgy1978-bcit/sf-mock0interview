// Mints a short-lived Simli session token server-side so SIMLI_API_KEY never
// reaches the browser. Mirrors the CORS + rate-limit pattern in tts.js and
// feedback.js.
//
// Only mints tokens for faces in our own interviewer roster — without this
// allowlist, anyone who found this endpoint could mint sessions against any
// Simli faceId using our API key, which still bills our account regardless
// of whose face they asked for.
const ALLOWED_FACE_IDS = new Set([
  'cace3ef7-a4c4-425d-a8cf-a5358eb0c427', // Mia Chen
  '7e74d6e7-d559-4394-bd56-4923a3ab75ad', // Arjun Patel
  'dd10cb5a-d31d-4f12-b69f-6db3383c006e', // Ryan Coleman
  'd2a5c7c6-fed9-4f55-bcb3-062f7cd20103', // Elena Voss
]);

const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

function rateLimit(req) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown';
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.start > WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    return { ok: true };
  }
  b.count += 1;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now - v.start > WINDOW_MS) buckets.delete(k);
  }
  return {
    ok: b.count <= MAX_PER_WINDOW,
    retryAfter: Math.ceil((WINDOW_MS - (now - b.start)) / 1000),
  };
}

function resolveOrigin(req) {
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin || '';
  if (allowed.length === 0) return { header: '*', ok: true };
  const match = allowed.find(a => origin === a || origin.startsWith(a + '/'));
  return match ? { header: match, ok: true } : { header: null, ok: false };
}

export default async function handler(req, res) {
  const { header: allowOrigin, ok: originOk } = resolveOrigin(req);
  if (allowOrigin) res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originOk) return res.status(403).json({ error: 'Origin not allowed' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const limit = rateLimit(req);
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: 'Too many requests. Slow down and try again.' });
  }

  try {
    const { faceId } = req.body || {};
    if (typeof faceId !== 'string' || !ALLOWED_FACE_IDS.has(faceId)) {
      return res.status(400).json({ error: 'Unknown faceId' });
    }

    const simliKey = process.env.SIMLI_API_KEY;
    if (!simliKey) return res.status(500).json({ error: 'Simli key not configured' });

    // Reconnect-per-question design (see simliAvatar.js): each session
    // covers one short utterance, so these caps stay tight — this is the
    // cost control, not just a safety net.
    const simliRes = await fetch('https://api.simli.ai/compose/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-simli-api-key': simliKey,
      },
      body: JSON.stringify({
        faceId,
        handleSilence: true,
        maxSessionLength: 60,
        maxIdleTime: 10,
        model: 'fasttalk',
      }),
    });

    if (!simliRes.ok) {
      const msg = await simliRes.text();
      return res.status(simliRes.status).json({ error: `Simli error: ${msg}` });
    }

    const data = await simliRes.json();
    return res.status(200).json({ session_token: data.session_token });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
