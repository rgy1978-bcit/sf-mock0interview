import { useState, useRef, useEffect } from "react";

const JOBS = [
  { id: "canes", emoji: "🍗", title: "Restaurant Crewmember", company: "Raising Cane's Chicken Fingers", interviewer: "Sarah Mitchell", interviewerTitle: "Hiring Manager", accent: "#B8860B", accentBg: "#FDF8EC", voiceGender: "female" },
  { id: "petplus", emoji: "🐾", title: "Store Team Member", company: "Pet Supplies Plus", interviewer: "Marcus Chen", interviewerTitle: "Store Manager", accent: "#C14E1A", accentBg: "#FDF2EC", voiceGender: "male" },
  { id: "sfcamp", emoji: "⛺", title: "Summer Camp Counselor", company: "SF Township Parks & Rec", interviewer: "Jennifer Kowalski", interviewerTitle: "Recreation Coordinator", accent: "#2E7D32", accentBg: "#EDF7EE", voiceGender: "female" },
  { id: "sfpark", emoji: "💦", title: "Park Attendant – Splash Pad", company: "SF Township Parks & Rec", interviewer: "Jennifer Kowalski", interviewerTitle: "Recreation Coordinator", accent: "#1565C0", accentBg: "#EAF1FB", voiceGender: "female" },
  { id: "swim", emoji: "🏊", title: "Swim Instructor", company: "South Fayette Aquatics", interviewer: "David Park", interviewerTitle: "Aquatics Director", accent: "#0277BD", accentBg: "#E8F4FB", voiceGender: "male" },
  { id: "guard", emoji: "🛟", title: "Lifeguard", company: "South Fayette Aquatics", interviewer: "David Park", interviewerTitle: "Aquatics Director", accent: "#A32D2D", accentBg: "#FBEAEA", voiceGender: "male" },
];

const BEHAVIORAL = [
  "Tell me about a time you had to learn a new skill. How did you approach it?",
  "Give me an example of a time when you set a goal and were able to achieve it.",
  "Give me an example of a time when you motivated others.",
  "Give me an example of a time when you showed initiative and took the lead.",
  "Tell me about a time you tried to accomplish something and failed. What happened?",
  "Tell me about a time you made a mistake and how you fixed it.",
  "Tell me about a time you had to manage a project with a deadline. How did you stay on track?",
  "Describe a time when a teammate was not pulling their weight. How did you handle that?",
  "Tell me about a time you had to work with someone you didn't get along with. How did you handle it?",
];
const SITUATIONAL = [
  "What would you do if you disagreed with a coworker or supervisor at work?",
  "Describe a time you persuaded someone to see things your way.",
  "Describe a time you made a decision that wasn't popular. Why did you make it?",
  "Describe a stressful situation you faced and explain how you coped with it.",
];
const GENERAL = [
  "What are your greatest strengths?",
  "What is one area you are working to improve, and what are you doing about it?",
  "What do you like to do in your free time?",
  "Where do you see yourself in five years?",
  "What are you most proud of from your time in high school?",
  "What personal characteristics do you think are necessary for success in this role?",
  "What do you know about our company, and what excites you most about this position?",
];

const TYPE_LABELS = {
  opening: "Opening question",
  behavioral: "Behavioral — use STAR",
  situational: "Situational",
  general: "General",
  closing: "Closing question",
  final: "Your turn to ask",
};

const FILLERS = ["um","uh","like","you know","so basically","basically","literally","kind of","sort of","i mean","right so","okay so","well um","I mean like"];

function detectFillers(text) {
  const lower = text.toLowerCase();
  const found = {};
  let total = 0;
  FILLERS.forEach(fw => {
    const esc = fw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = lower.match(new RegExp(`\\b${esc}\\b`, "gi"));
    if (m) { found[fw] = m.length; total += m.length; }
  });
  return { found, total };
}

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }

function buildQuestions() {
  const mid = shuffle([
    { text: shuffle(BEHAVIORAL)[0], type: "behavioral" },
    { text: shuffle(BEHAVIORAL)[1], type: "behavioral" },
    { text: shuffle(SITUATIONAL)[0], type: "situational" },
    { text: shuffle(GENERAL)[0], type: "general" },
  ]);
  return [
    { text: "Tell me about yourself.", type: "opening" },
    ...mid,
    { text: "Why do you want to work here? Why should we hire you over other candidates?", type: "closing" },
    { text: "Do you have any questions for us?", type: "final" },
  ];
}

function fmtTime(s) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`; }

function cleanForSpeech(text) {
  return text
    .replace(/\*\*([^*]+):\*\*/g, "$1. ")
    .replace(/\*\*/g, "")
    .replace(/^[•-] /gm, ". ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function callAI(system, message) {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI error');
  return data.text;
}

async function fetchTTS(text, gender) {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, gender }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `TTS error ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function getFeedback(job, question, answer, metrics) {
  const isBeh = question.type === "behavioral";
  const isFin = question.type === "final";
  let delivery = "";
  if (metrics) {
    const pace = metrics.wpm < 5 ? "" : metrics.wpm < 110 ? `${metrics.wpm} WPM, a bit slow` : metrics.wpm > 195 ? `${metrics.wpm} WPM, quite fast` : `${metrics.wpm} WPM, good pace`;
    const fill = metrics.fillers.total === 0 ? "No filler words" : `${metrics.fillers.total} filler words: ${Object.entries(metrics.fillers.found).map(([w, c]) => `"${w}" x${c}`).join(", ")}`;
    delivery = `\nSPEECH DATA: ${fill}. Pace: ${pace}. Length: ${metrics.wordCount} words, ${metrics.duration}s.`;
  }
  const sys = `You are a warm interview coach for an 11th-grade student (age 16) practicing for a job interview at ${job.company} for ${job.title}. You will be read aloud to the student, so write in a natural spoken style — avoid bullet symbols, markdown, or lists. Use complete sentences throughout.${delivery}

Respond in under 140 words. Use EXACTLY these labels at the start of each paragraph (no asterisks, just the plain label followed by a colon):

Assessment: [1–2 sentences on the answer overall]
Strength: [One specific thing they did well]
Tip: [One concrete improvement for next time]${metrics ? "\nDelivery: [Specific spoken feedback on filler words and pace]" : ""}${isBeh ? "\nSTAR check: [Which parts of Situation, Task, Action, Result were present, and what was missing]" : ""}${isFin ? "\nYour questions: [Were they thoughtful? Did they avoid asking about salary, hours, or benefits?]" : ""}`;
  return await callAI(sys, `Question: "${question.text}"\nAnswer: "${answer}"`);
}

async function getSummary(job, answers) {
  const log = answers.map((a, i) => {
    let s = `Q${i + 1} [${a.type}]: ${a.question}\nAnswer: ${a.answer}`;
    if (a.metrics) s += `\nDelivery: ${a.metrics.wpm} WPM, ${a.metrics.fillers.total} filler words`;
    return s;
  }).join("\n\n");
  const sys = `Write a final coaching summary for an 11th-grade student who just practiced for ${job.title} at ${job.company}. This will be read aloud to the student, so write in a warm, natural spoken style — no bullet points, no markdown, no asterisks. Use complete paragraphs throughout. Under 200 words.

Use these plain labels at the start of each paragraph:

Overall impression: [2–3 sentences]
Top strength: [1–2 sentences]
Biggest growth area: [1–2 sentences]
Speech habits: [Filler words and pace patterns across the session, or say "Your delivery was clean throughout" if no issues]
Before your real mock interview: [Three action items written as a short paragraph, not a list]
You've got this. [One encouraging closing sentence]`;
  return await callAI(sys, log);
}

export default function App() {
  const [screen, setScreen] = useState("select");
  const [job, setJob] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qi, setQi] = useState(0);
  const [mode, setMode] = useState("voice");
  const [speechOk, setSpeechOk] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [questionReady, setQuestionReady] = useState(false);
  const [isRec, setIsRec] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [recorded, setRecorded] = useState(false);
  const [vol, setVol] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [metrics, setMetrics] = useState(null);
  const [textAns, setTextAns] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loadFb, setLoadFb] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loadSum, setLoadSum] = useState(false);

  const recRef = useRef(null);
  const stopFlagRef = useRef(false);
  const txRef = useRef("");
  const audioCtxRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const fbRef = useRef(null);
  const voicesRef = useRef([]);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) { setSpeechOk(false); setMode("text"); }
    const loadVoices = () => { voicesRef.current = window.speechSynthesis?.getVoices() || []; };
    loadVoices();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      stopCurrentAudio();
      cleanupMic();
    };
  }, []);

  useEffect(() => {
    if (screen === "interview" && job && questions.length > 0) {
      setQuestionReady(false);
      setFeedback(null);
      const q = questions[qi];
      const intro = qi === 0 ? `Hi, I'm ${job.interviewer}, ${job.interviewerTitle} at ${job.company}. Thanks for coming in today. Let's get started. ` : "";
      speakText(`${intro}${q.text}`, job.voiceGender, () => setQuestionReady(true));
    }
  }, [qi, screen]);

  useEffect(() => {
    if (feedback) {
      setTimeout(() => {
        speakText(cleanForSpeech(feedback), job.voiceGender);
        if (fbRef.current) fbRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 300);
    }
  }, [feedback]);

  function stopCurrentAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current._blobUrl) URL.revokeObjectURL(audioRef.current._blobUrl);
      audioRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  async function speakText(text, gender = "female", onEnd = null) {
    stopCurrentAudio();
    setIsSpeaking(true);
    try {
      const url = await fetchTTS(text, gender);
      const audio = new Audio(url);
      audio._blobUrl = url;
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; setIsSpeaking(false); if (onEnd) onEnd(); };
      audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; setIsSpeaking(false); if (onEnd) onEnd(); };
      await audio.play();
    } catch (e) {
      console.warn("Azure TTS failed, falling back to browser voices:", e);
      fallbackSpeak(text, gender, onEnd);
    }
  }

  function fallbackSpeak(text, gender = "female", onEnd = null) {
    if (!window.speechSynthesis) { setIsSpeaking(false); if (onEnd) onEnd(); return; }
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.91; utt.pitch = gender === "female" ? 1.05 : 0.92; utt.volume = 1.0;
    const voices = voicesRef.current;
    const eng = voices.filter(v => v.lang.startsWith("en"));
    const genMatch = eng.filter(v => gender === "female"
      ? /zira|hazel|susan|emma|jenny|aria|samantha|victoria|kate|moira|female/i.test(v.name)
      : /david|mark|george|ryan|james|daniel|guy|male/i.test(v.name));
    const premium = (genMatch.length > 0 ? genMatch : eng).filter(v => /natural|neural|premium|enhanced|online/i.test(v.name));
    if (premium.length > 0) utt.voice = premium[0];
    else if (genMatch.length > 0) utt.voice = genMatch[0];
    else if (eng.length > 0) utt.voice = eng[0];
    utt.onend = () => { setIsSpeaking(false); if (onEnd) onEnd(); };
    utt.onerror = () => { setIsSpeaking(false); if (onEnd) onEnd(); };
    window.speechSynthesis.speak(utt);
  }

  function stopSpeaking(andReady = false) {
    stopCurrentAudio();
    setIsSpeaking(false);
    if (andReady) setQuestionReady(true);
  }

  function replayQuestion() { speakText(questions[qi].text, job.voiceGender, () => setQuestionReady(true)); }
  function replayFeedback() { if (feedback) speakText(cleanForSpeech(feedback), job.voiceGender); }

  function cleanupMic() {
    stopFlagRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current?.state !== "closed") audioCtxRef.current?.close().catch(() => {});
  }

  async function startRec() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    txRef.current = ""; stopFlagRef.current = false;
    setLiveText(""); setFinalText(""); setRecorded(false); setMetrics(null); setVol(0); setElapsed(0);
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    recRef.current = rec;
    rec.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) txRef.current += e.results[i][0].transcript + " ";
        else interim = e.results[i][0].transcript;
      }
      setFinalText(txRef.current); setLiveText(interim);
    };
    rec.onerror = e => { if (e.error === "not-allowed") alert("Microphone access denied. Please allow microphone access in your browser settings."); };
    rec.onend = () => { if (!stopFlagRef.current && recRef.current) { try { rec.start(); } catch {} } };
    rec.start();
    setIsRec(true);
    startRef.current = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.7;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setVol(Math.min(100, Math.round(avg * 3.2)));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {}
  }

  function stopRec() {
    stopFlagRef.current = true;
    if (recRef.current) { recRef.current.stop(); recRef.current = null; }
    cleanupMic();
    setIsRec(false); setVol(0);
    const dur = startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0;
    setElapsed(dur);
    setTimeout(() => {
      const t = txRef.current.trim();
      if (t) {
        const fillers = detectFillers(t);
        const wc = t.split(/\s+/).filter(Boolean).length;
        const wpm = dur >= 3 ? Math.round((wc / dur) * 60) : 0;
        setMetrics({ fillers, wpm, wordCount: wc, duration: dur });
      }
      setRecorded(true);
    }, 600);
  }

  function clearAns() {
    txRef.current = "";
    setFinalText(""); setLiveText(""); setRecorded(false); setMetrics(null); setTextAns(""); setElapsed(0);
  }

  function pickJob(j) { setJob(j); setQuestions(buildQuestions()); setScreen("tips"); }
  function begin() { setQi(0); setAnswers([]); clearAns(); setFeedback(null); setQuestionReady(false); setScreen("interview"); }

  async function submit() {
    const ans = mode === "voice" ? finalText.trim() : textAns.trim();
    if (!ans || loadFb) return;
    stopSpeaking();
    setLoadFb(true);
    try {
      const m = mode === "voice" ? metrics : null;
      const fb = await getFeedback(job, questions[qi], ans, m);
      setFeedback(fb);
      setAnswers(p => [...p, { question: questions[qi].text, type: questions[qi].type, answer: ans, metrics: m }]);
    } catch { setFeedback("Good effort! Focus on specific real-life examples from your own life."); }
    setLoadFb(false);
  }

  async function next() {
    stopSpeaking();
    if (qi < questions.length - 1) { setQi(qi + 1); clearAns(); setFeedback(null); setQuestionReady(false); }
    else {
      setScreen("summary"); setLoadSum(true);
      try { setSummary(await getSummary(job, answers)); } catch { setSummary("Great job completing your practice interview!"); }
      setLoadSum(false);
    }
  }

  function reset() {
    stopSpeaking();
    setScreen("select"); setJob(null); setQuestions([]); setQi(0);
    clearAns(); setFeedback(null); setAnswers([]); setSummary(null); setQuestionReady(false);
  }

  const S = {
    wrap: { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#111827", padding: "20px 16px", minHeight: "100vh" },
    card: { background: "#ffffff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "20px 24px" },
    muted: { color: "#6b7280", fontSize: 13 },
    center: { maxWidth: 680, margin: "0 auto" },
  };

  function renderFeedback(text) {
    return text.split("\n").map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: 5 }} />;
      const m = line.match(/^([A-Za-z ]+):\s*(.+)$/);
      if (m) return (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 500, fontSize: 13, whiteSpace: "nowrap" }}>{m[1]}:</span>
          <span style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.6, flex: 1, minWidth: 200 }}>{m[2]}</span>
        </div>
      );
      return <div key={i} style={{ color: "#6b7280", lineHeight: 1.7 }}>{line}</div>;
    });
  }

  function SpeakingBadge({ onStop, onReplay, label }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {isSpeaking ? (
          <>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: job.accent }}>
              <span style={{ animation: "soundWave 1s ease-in-out infinite" }}>🔊</span> {label}
            </span>
            <button onClick={onStop} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, border: `0.5px solid ${job.accent}`, background: "none", color: job.accent, cursor: "pointer" }}>Stop</button>
          </>
        ) : (
          <button onClick={onReplay} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, border: "0.5px solid #e5e7eb", background: "none", color: "#6b7280", cursor: "pointer" }}>🔊 Replay</button>
        )}
      </div>
    );
  }

  // ── SELECT ──
  if (screen === "select") return (
    <div style={S.wrap}>
      <div style={S.center}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ color: "#6b7280", fontWeight: 500, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, fontSize: 13 }}>College & Career Prep · South Fayette High School</div>
          <div style={{ fontSize: 24, fontWeight: 500, marginBottom: 6 }}>Mock Interview Practice</div>
          <div style={S.muted}>Select the job you are interviewing for to begin.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
          {JOBS.map(j => (
            <button key={j.id} onClick={() => pickJob(j)} style={{ ...S.card, textAlign: "left", cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = j.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#e5e7eb"}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{j.emoji}</div>
              <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 3 }}>{j.title}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: j.accent, marginBottom: 4 }}>{j.company}</div>
              <div style={S.muted}>with {j.interviewer}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── TIPS ──
  if (screen === "tips") return (
    <div style={S.wrap}>
      <div style={S.center}>
        <button onClick={() => setScreen("select")} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", marginBottom: 16, padding: 0, fontSize: 13 }}>← Back</button>
        <div style={{ ...S.card, marginBottom: 14, borderTop: `3px solid ${job.accent}` }}>
          <div style={S.muted}>You are interviewing for</div>
          <div style={{ fontWeight: 500, fontSize: 18, margin: "4px 0 2px" }}>{job.title}</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: job.accent, marginBottom: 2 }}>{job.company}</div>
          <div style={S.muted}>with {job.interviewer}, {job.interviewerTitle}</div>
        </div>
        <div style={{ ...S.card, marginBottom: 14 }}>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 12 }}>⭐ STAR method for behavioral questions</div>
          {[["S","Situation","Set the scene — where and when?"],["T","Task","What was your responsibility?"],["A","Action","What steps did you specifically take?"],["R","Result","What happened? What did you learn?"]].map(([l,w,d]) => (
            <div key={l} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ background: job.accent, color: "#fff", borderRadius: 5, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, fontSize: 11, flexShrink: 0, marginTop: 1 }}>{l}</span>
              <span style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}><strong style={{ color: "#111827", fontWeight: 500 }}>{w}</strong> — {d}</span>
            </div>
          ))}
        </div>
        <div style={{ ...S.card, marginBottom: 14 }}>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>🎤 How this works</div>
          <div style={{ color: "#6b7280", lineHeight: 1.8, fontSize: 13 }}>
            {job.interviewer} will speak each question out loud — listen, then record your spoken answer. After you submit, {job.interviewer} will read your coaching feedback to you. You can replay any question or feedback at any time, and switch to typing if needed.
            {!speechOk && <span style={{ display: "block", marginTop: 8, fontSize: 12 }}>Note: Voice input is not available in this browser — you will type your answers.</span>}
          </div>
        </div>
        <button onClick={begin} style={{ width: "100%", background: job.accent, color: "#fff", border: "none", borderRadius: 8, padding: 14, fontSize: 15, fontWeight: 500, cursor: "pointer" }}>
          Begin interview →
        </button>
      </div>
    </div>
  );

  // ── INTERVIEW ──
  if (screen === "interview") {
    const q = questions[qi];
    const isLast = qi === questions.length - 1;
    const canSubmit = !loadFb && (mode === "voice" ? (recorded && finalText.trim().length > 0) : textAns.trim().length > 0);
    const bars = Array.from({ length: 8 }, (_, i) => (
      <div key={i} style={{ width: 4, height: 4 + i * 3, borderRadius: 2, background: isRec && vol >= (i + 1) * 12 ? job.accent : "#e5e7eb", transition: "background 0.08s" }} />
    ));

    return (
      <div style={S.wrap}>
        <style>{`
          @keyframes ripple { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.8); opacity: 0; } }
          @keyframes micPulse { 0%,100% { box-shadow: 0 0 0 0 #C6282855; } 50% { box-shadow: 0 0 0 10px #C6282800; } }
          @keyframes avatarGlow { 0%,100% { box-shadow: 0 0 0 2px ${job.accent}55; } 50% { box-shadow: 0 0 0 8px ${job.accent}22; } }
          @keyframes soundWave { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div style={S.center}>
          <div style={{ ...S.card, marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: job.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 500, fontSize: 15, flexShrink: 0, animation: isSpeaking ? "avatarGlow 1.2s ease-in-out infinite" : "none" }}>
              {job.interviewer.split(" ").map(n => n[0]).join("")}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{job.interviewer}</div>
              <div style={S.muted}>{job.interviewerTitle} · {job.company}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={S.muted}>Question</div>
              <div style={{ fontWeight: 500, fontSize: 20 }}>{qi + 1}<span style={{ color: "#6b7280" }}>/{questions.length}</span></div>
            </div>
          </div>

          <div style={{ height: 3, background: "#e5e7eb", borderRadius: 2, marginBottom: 16 }}>
            <div style={{ height: "100%", background: job.accent, borderRadius: 2, width: `${((qi + 1) / questions.length) * 100}%`, transition: "width 0.4s" }} />
          </div>

          <div style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, color: "#6b7280", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "2px 8px" }}>
                {TYPE_LABELS[q.type]}
              </span>
              <SpeakingBadge onStop={() => stopSpeaking(true)} onReplay={replayQuestion} label={`${job.interviewer} is speaking…`} />
            </div>
            <div style={{ color: "#6b7280", fontStyle: "italic", marginBottom: 4, fontSize: 12 }}>{job.interviewer} asks:</div>
            <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.6, marginBottom: q.type === "behavioral" || q.type === "final" ? 14 : 0 }}>"{q.text}"</div>
            {q.type === "behavioral" && (
              <div style={{ background: job.accentBg, border: `0.5px solid ${job.accent}44`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: job.accent }}>
                ⭐ STAR: Situation → Task → Action → Result
              </div>
            )}
            {q.type === "final" && (
              <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>
                Prepare 2 thoughtful questions. Avoid asking about pay, hours, or benefits.
              </div>
            )}
          </div>

          {!questionReady && !feedback && (
            <div style={{ ...S.card, marginBottom: 12, textAlign: "center", padding: "24px" }}>
              <div style={{ color: "#6b7280", marginBottom: 16, fontSize: 14 }}>
                {isSpeaking ? `${job.interviewer} is asking your question…` : "Preparing question…"}
              </div>
              {isSpeaking && (
                <button onClick={() => stopSpeaking(true)} style={{ background: "none", border: `0.5px solid ${job.accent}`, color: job.accent, borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                  Skip — ready to answer →
                </button>
              )}
            </div>
          )}

          {questionReady && !feedback && (
            <div style={{ ...S.card, marginBottom: 12 }}>
              {speechOk && (
                <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                  {["voice", "text"].map(m => (
                    <button key={m} onClick={() => { setMode(m); clearAns(); }} style={{ padding: "5px 14px", fontSize: 12, fontWeight: mode === m ? 500 : 400, background: mode === m ? job.accent : "#f9fafb", color: mode === m ? "#fff" : "#6b7280", border: `0.5px solid ${mode === m ? job.accent : "#e5e7eb"}`, borderRadius: 8, cursor: "pointer" }}>
                      {m === "voice" ? "🎤 Speak" : "⌨️ Type"}
                    </button>
                  ))}
                </div>
              )}

              {mode === "voice" && (
                <div>
                  {!recorded && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <div style={{ position: "relative" }}>
                        {isRec && <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: `2px solid ${job.accent}`, animation: "ripple 1.2s ease-out infinite" }} />}
                        <button onClick={isRec ? stopRec : startRec} style={{ width: 64, height: 64, borderRadius: "50%", background: isRec ? "#C62828" : job.accent, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", animation: isRec ? "micPulse 1.4s ease-in-out infinite" : "none", transition: "background 0.2s", position: "relative" }}>
                          <span style={{ fontSize: 26 }}>{isRec ? "⏹" : "🎤"}</span>
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 28 }}>{bars}</div>
                      {isRec
                        ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><div style={{ fontSize: 20, fontWeight: 500, color: "#C62828", fontVariantNumeric: "tabular-nums" }}>{fmtTime(elapsed)}</div><div style={{ color: "#6b7280", fontSize: 11 }}>Tap ⏹ to stop</div></div>
                        : <div style={{ color: "#6b7280", fontSize: 12 }}>Tap 🎤 to start speaking your answer</div>}
                    </div>
                  )}
                  {(isRec || finalText) && (
                    <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", minHeight: 60, marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Transcript</div>
                      <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                        {finalText}
                        {liveText && <span style={{ color: "#9ca3af" }}> {liveText}</span>}
                        {!finalText && !liveText && isRec && <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Listening…</span>}
                      </div>
                    </div>
                  )}
                  {recorded && metrics && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                        {metrics.wpm > 0 && (() => { const ok = metrics.wpm >= 110 && metrics.wpm <= 195; return <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: ok ? "#EDF7EE" : "#FFF8E1", color: ok ? "#2E7D32" : "#E65100", border: `0.5px solid ${ok ? "#81C784" : "#FFAB40"}` }}>{metrics.wpm} WPM · {ok ? "Good pace" : metrics.wpm < 110 ? "Slow — speak faster" : "Fast — slow down"}</span>; })()}
                        {(() => { const f = metrics.fillers.total; return <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: f === 0 ? "#EDF7EE" : f <= 2 ? "#FFF8E1" : "#FBEAEA", color: f === 0 ? "#2E7D32" : f <= 2 ? "#E65100" : "#A32D2D", border: `0.5px solid ${f === 0 ? "#81C784" : f <= 2 ? "#FFAB40" : "#EF9A9A"}` }}>{f === 0 ? "No filler words ✓" : `${f} filler word${f > 1 ? "s" : ""} — ${Object.keys(metrics.fillers.found).slice(0, 2).map(w => `"${w}"`).join(", ")}`}</span>; })()}
                        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#f9fafb", color: "#6b7280", border: "0.5px solid #e5e7eb" }}>{metrics.wordCount} words · {fmtTime(metrics.duration)}</span>
                      </div>
                      <button onClick={clearAns} style={{ fontSize: 12, background: "none", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "4px 12px", cursor: "pointer", color: "#6b7280" }}>Record again</button>
                    </div>
                  )}
                  {recorded && !finalText.trim() && <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 12 }}>Nothing captured — try again or switch to typing.</div>}
                </div>
              )}

              {mode === "text" && (
                <textarea value={textAns} onChange={e => setTextAns(e.target.value)}
                  placeholder={q.type === "final" ? "Type the questions you would ask the interviewer..." : "Type your answer as if speaking in the real interview..."}
                  style={{ width: "100%", minHeight: 130, border: "0.5px solid #d1d5db", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical", color: "#111827", background: "#fff", outline: "none", lineHeight: 1.6, boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = job.accent}
                  onBlur={e => e.target.style.borderColor = "#d1d5db"}
                />
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button onClick={submit} disabled={!canSubmit} style={{ background: canSubmit ? job.accent : "#f9fafb", color: canSubmit ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: canSubmit ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 8 }}>
                  {loadFb ? <><span style={{ width: 14, height: 14, border: "2px solid #ffffff66", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Getting feedback…</> : "Submit answer →"}
                </button>
              </div>
            </div>
          )}

          {feedback && (
            <div ref={fbRef} style={{ ...S.card, borderLeft: `3px solid ${job.accent}`, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Coach feedback</div>
                <SpeakingBadge onStop={() => stopSpeaking(false)} onReplay={replayFeedback} label={`${job.interviewer} is reading feedback…`} />
              </div>
              <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Your answer</div>
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{mode === "voice" ? finalText : textAns}</div>
              </div>
              {renderFeedback(feedback)}
              <button onClick={next} style={{ marginTop: 16, width: "100%", background: job.accent, color: "#fff", border: "none", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                {isLast ? "Complete interview and see summary →" : "Next question →"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── SUMMARY ──
  if (screen === "summary") {
    const voiceCount = answers.filter(a => a.metrics).length;
    const totalFillers = answers.reduce((s, a) => s + (a.metrics?.fillers.total || 0), 0);
    const wpmArr = answers.filter(a => a.metrics?.wpm > 0).map(a => a.metrics.wpm);
    const avgWpm = wpmArr.length > 0 ? Math.round(wpmArr.reduce((a, b) => a + b, 0) / wpmArr.length) : 0;

    return (
      <div style={S.wrap}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={S.center}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Interview complete</div>
            <div style={S.muted}>{job.title} · {job.company}</div>
          </div>

          {voiceCount > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
              {[["Voice answers", voiceCount], ["Total filler words", totalFillers], ["Avg pace", avgWpm > 0 ? `${avgWpm} WPM` : "—"]].map(([label, val]) => (
                <div key={label} style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>{val}</div>
                  <div style={{ color: "#6b7280", fontSize: 11, lineHeight: 1.4 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ ...S.card, borderTop: `3px solid ${job.accent}`, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 500, fontSize: 15 }}>Performance summary</div>
              {summary && <SpeakingBadge onStop={() => stopSpeaking(false)} onReplay={() => speakText(cleanForSpeech(summary), job.voiceGender)} label="Reading summary…" />}
            </div>
            {loadSum
              ? <div style={{ textAlign: "center", padding: "32px 0", color: "#6b7280" }}>Generating your personalized summary…</div>
              : <div>{renderFeedback(summary || "")}</div>}
          </div>

          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 14 }}>Your answers</div>
            {answers.map((a, i) => (
              <div key={i} style={{ borderBottom: i < answers.length - 1 ? "0.5px solid #e5e7eb" : "none", paddingBottom: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, color: "#6b7280", marginBottom: 4 }}>Q{i + 1} · {a.type}</div>
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 6 }}>{a.question}</div>
                <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.6, marginBottom: a.metrics ? 8 : 0 }}>{a.answer}</div>
                {a.metrics && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {a.metrics.wpm > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#f9fafb", color: "#6b7280" }}>{a.metrics.wpm} WPM</span>}
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: a.metrics.fillers.total === 0 ? "#EDF7EE" : "#FFF8E1", color: a.metrics.fillers.total === 0 ? "#2E7D32" : "#E65100" }}>{a.metrics.fillers.total === 0 ? "No fillers" : `${a.metrics.fillers.total} filler${a.metrics.fillers.total > 1 ? "s" : ""}`}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button onClick={reset} style={{ width: "100%", background: job.accent, color: "#fff", border: "none", borderRadius: 8, padding: 14, fontSize: 15, fontWeight: 500, cursor: "pointer", marginBottom: 24 }}>
            Practice again with a different job →
          </button>
        </div>
      </div>
    );
  }

  return null;
}
