export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, gender } = req.body;
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
