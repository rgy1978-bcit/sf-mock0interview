// In-memory best-effort rate limiter. Vercel serverless instances aren't
// shared reliably across invocations, so this catches casual abuse but is
// not a hard cap. Swap for Upstash Ratelimit when traffic warrants it.
const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;

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
    const { system, message, jsonMode } = req.body || {};
    if (typeof system !== 'string' || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    if (system.length > 6000 || message.length > 16000) {
      return res.status(413).json({ error: 'Request too large' });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return res.status(500).json({ error: 'Gemini key not configured' });

    const generationConfig = {
      maxOutputTokens: jsonMode ? 2000 : 1000,
      temperature: jsonMode ? 0.4 : 0.7,
    };
    if (jsonMode) generationConfig.responseMimeType = 'application/json';

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }],
          systemInstruction: { parts: [{ text: system }] },
          generationConfig,
        }),
      }
    );

    if (!geminiRes.ok) {
      const msg = await geminiRes.text();
      return res.status(geminiRes.status).json({ error: `Gemini error: ${msg}` });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
