// Read-aloud. First choice: Google Gemini Live through the local helper (serve.py, POST api/speak, raw 16-bit PCM at 24 kHz); the API key stays on
// the computer, never in the page. Anywhere else (GitHub Pages, no key, Gemini fails) it falls back to the browser's built-in speech synthesis.
const BCP = { he: 'he', en: 'en', ru: 'ru', fr: 'fr', es: 'es' };
const synth = () => ('speechSynthesis' in self ? speechSynthesis : null);
const browserVoice = lang => (synth()?.getVoices() || []).find(v => v.lang?.toLowerCase().startsWith(BCP[lang])) || null;
const SR = 24000, PIECE = 600, MAX_PIECE = 1000;      // piece sizes in characters; the helper accepts up to 1200
let gemini = false;                                   // does the helper answer and hold a key?
fetch('api/speak/ping', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => { gemini = !!j?.gemini; }).catch(() => {});
let ctx = null, ctl = null, gen = 0, live = false, srcs = [], finish = null;

export const voiceFor = lang => (gemini ? { name: 'Gemini' } : browserVoice(lang));
export const supported = () => gemini || !!synth();
export const speaking = () => live || !!synth()?.speaking;

/** the text cut at sentence ends into pieces the helper accepts (one Gemini session each) */
export function pieces(text) {
  const out = []; let cur = '';
  for (const s of String(text).split(/(?<=[.!?:;])\s+|\n+/)) {
    const t = s.trim(); if (!t) continue;
    if (cur && cur.length + t.length + 1 > PIECE) { out.push(cur); cur = t; } else cur = cur ? cur + ' ' + t : t;
  }
  if (cur) out.push(cur);
  return out.flatMap(p => { const r = []; for (let i = 0; i < p.length; i += MAX_PIECE) r.push(p.slice(i, i + MAX_PIECE)); return r; });
}

function browserSpeak(text, lang, rate, onend) {
  const s = synth(); if (!s) { onend?.(); return false; }
  s.cancel();
  const u = new SpeechSynthesisUtterance(text), v = browserVoice(lang);
  if (v) u.voice = v; u.lang = v?.lang || ({ he: 'he-IL', en: 'en-US', ru: 'ru-RU', fr: 'fr-FR', es: 'es-ES' })[lang]; u.rate = rate;
  u.onend = u.onerror = () => onend?.();
  s.speak(u); return true;
}

function stopGemini() {
  gen++; ctl?.abort(); ctl = null;
  for (const s of srcs) { s.onended = null; try { s.stop(); } catch { /* already stopped */ } }
  srcs = []; try { ctx?.close(); } catch { /* already closed */ } ctx = null;
  live = false; const f = finish; finish = null; f?.();
}

/** one piece: reads the helper's PCM stream and hands every chunk to sink(Float32Array) */
async function fetchPcm(p, lang, signal, sink) {
  const r = await fetch('api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: p, lang }), signal });
  if (!r.ok || !r.body) { if (r.status === 503) gemini = false; throw new Error('speak ' + r.status); }
  const rd = r.body.getReader(); let carry = null;
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    let b = value; if (carry) { b = new Uint8Array(carry.length + value.length); b.set(carry); b.set(value, carry.length); carry = null; }
    if (b.length & 1) { carry = b.slice(b.length - 1); b = b.subarray(0, b.length - 1); }
    const n = b.length >> 1; if (!n) continue;
    const dv = new DataView(b.buffer, b.byteOffset, b.length), f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = dv.getInt16(i * 2, true) / 32768;
    sink(f);
  }
}
/** the next piece is requested before the current one ends (Gemini speaks about as fast as it plays), its audio held until its turn */
const startFetch = (p, lang, signal) => {
  const q = { held: [], sink: null, err: null, text: p }; q.done = fetchPcm(p, lang, signal, f => (q.sink ? q.sink(f) : q.held.push(f))).catch(e => { q.err = e; });
  return q;
};
const estSeconds = p => p.length / 11;     // measured: about 10 Hebrew characters per second of speech (other languages differ, so the request for the next piece goes out at 60% of this)

async function geminiSpeak(text, lang, rate, onend) {
  stopGemini(); synth()?.cancel();
  const my = ++gen, ac = new AbortController(); ctl = ac; live = true;
  try { ctx = new AudioContext({ sampleRate: SR }); await ctx.resume(); } catch { if (my !== gen) return true; live = false; return browserSpeak(text, lang, rate, onend); }
  if (my !== gen) return true;                                     // stopped (or a newer read started) while the audio device woke up
  let done = false; const end = () => { if (done) return; done = true; onend?.(); }; finish = end;
  const ps = pieces(text); let at = 0, any = false, cur = startFetch(ps[0], lang, ac.signal);
  const schedule = f => {
    const buf = ctx.createBuffer(1, f.length, SR); buf.copyToChannel(f, 0);
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate; src.connect(ctx.destination);
    const t = Math.max(at, ctx.currentTime + 0.05); src.start(t); at = t + buf.duration / rate; srcs.push(src); any = true; return f.length / SR;
  };
  for (let i = 0; i < ps.length; i++) {
    if (my !== gen) return true;
    let got = 0, next = null; const take = f => { if (my === gen) got += schedule(f); };   // a stopped read must never put sound on a newer read's clock
    cur.held.forEach(take); cur.held = []; cur.sink = take;
    const poll = setInterval(() => { if (!next && i + 1 < ps.length && got >= estSeconds(ps[i]) * 0.6) next = startFetch(ps[i + 1], lang, ac.signal); }, 250);
    await cur.done; clearInterval(poll);
    if (my !== gen) return true;                                   // stopped by the user
    if (cur.err) {
      if (!any) { finish = null; stopGemini(); return browserSpeak(text, lang, rate, onend); }   // Gemini did not work: the built-in voice instead (its own onend)
      ac.abort(); break;                                           // failed half-way: what was read stays, the rest is not read (and no more is requested)
    }
    if (i + 1 < ps.length) cur = next || startFetch(ps[i + 1], lang, ac.signal);
  }
  if (my !== gen) return true;
  if (!srcs.length) { stopGemini(); return true; }
  // the stream usually closes a moment AFTER the last sound has played, so an 'ended' event on the last source can be missed: poll the audio clock instead
  const tick = () => {
    if (my !== gen || !ctx) return;
    if (ctx.currentTime < at + 0.35) { setTimeout(tick, 120); return; }     // +0.35 s: the output device (Bluetooth especially) plays slightly behind the clock
    live = false; srcs = []; try { ctx.close(); } catch { /* closed */ } ctx = null; finish = null; end();
  };
  tick();
  return true;
}

export function speak(text, lang, rate = 1, onend) {
  if (gemini) { geminiSpeak(text, lang, rate, onend); return true; }
  return browserSpeak(text, lang, rate, onend);
}
export const stop = () => { stopGemini(); synth()?.cancel(); };
if (synth()) synth().getVoices();     // warm up the voice list (Chrome loads it async)
