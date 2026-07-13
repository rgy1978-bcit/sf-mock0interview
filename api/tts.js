const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

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
    const { text, gender } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Missing text' });
    }
    if (text.length > 6000) {
      return res.status(413).json({ error: 'Text too long' });
    }

    const azureKey = process.env.AZURE_SPEECH_KEY;
    if (!azureKey) return res.status(500).json({ error: 'Azure key not configured' });

    const voiceName = gender === 'female' ? 'en-US-AriaNeural' : 'en-US-GuyNeural';
    const safe = String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voiceName}'><prosody rate='-5%'>${safe}</prosody></voice></speak>`;

    const azureRes = await fetch('https://eastus.tts.speech.microsoft.com/cognitiveservices/v1', {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    });

    if (!azureRes.ok) {
      const msg = await azureRes.text();
      return res.status(azureRes.status).json({ error: `Azure ${azureRes.status}: ${msg}` });
    }

    const audio = await azureRes.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(Buffer.from(audio));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
