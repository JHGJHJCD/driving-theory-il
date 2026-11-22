// Sound effects, synthesized with WebAudio: no audio files, no network. Works offline.
// Every sound is started from a user gesture (a click or key), which browsers require.
// Preference is kept in its own localStorage key (not in the progress file), so backups are unaffected.
const KEY = 'theory-il-sfx';
let ctx = null, master = null;
let prefs = { on: true, vol: 0.6 };
try { const p = JSON.parse(localStorage.getItem(KEY)); if (p && typeof p === 'object') prefs = { on: p.on !== false, vol: Math.min(1, Math.max(0, +p.vol || 0.6)) }; } catch {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {} };

export const enabled = () => prefs.on;
export const volume = () => prefs.vol;
export function setEnabled(on) { prefs.on = !!on; persist(); if (!on) stopAll(); }
export function setVolume(v) { prefs.vol = Math.min(1, Math.max(0, +v)); persist(); if (master) master.gain.value = prefs.vol; }

function ac() {
  if (!prefs.on) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    try { ctx = new C(); master = ctx.createGain(); master.gain.value = prefs.vol; master.connect(ctx.destination); } catch { ctx = null; return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
const live = new Set();   // long-running sounds (engine, blinker) so they can be stopped together
export function stopAll() { for (const s of [...live]) { try { s.stop(); } catch {} } live.clear(); }

// one note: type, frequency (Hz) or [from,to] glide, start offset, duration, peak gain
function tone(type, freq, at, dur, peak = 0.25, dest = null) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  if (Array.isArray(freq)) { o.frequency.setValueAtTime(freq[0], t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, freq[1]), t0 + dur); } else o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.03);
}
function noise(at, dur, peak, lo, hi, dest = null) {
  const c = ac(); if (!c) return null;
  const n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = (lo + hi) / 2; f.Q.value = Math.max(0.3, ((lo + hi) / 2) / Math.max(1, hi - lo));
  const g = c.createGain(); const t0 = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(dest || master); src.start(t0); return src;
}
const N = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5 };

// ---- interface sounds ----
export const click = () => tone('triangle', 620, 0, 0.05, 0.12);
export const next = () => { tone('sine', [420, 560], 0, 0.09, 0.14); };
export const correct = () => { tone('sine', N.C5, 0, 0.14, 0.22); tone('sine', N.E5, 0.09, 0.14, 0.22); tone('sine', N.G5, 0.18, 0.28, 0.24); tone('triangle', N.C6, 0.18, 0.28, 0.06); };
export const wrong = () => { tone('triangle', [250, 190], 0, 0.22, 0.26); tone('triangle', [190, 140], 0.17, 0.3, 0.26); };
export const pass = () => { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone('triangle', f, i * 0.13, 0.35, 0.22)); tone('sine', N.G5, 0.55, 0.7, 0.2); tone('sine', N.C6, 0.55, 0.7, 0.2); };
export const fail = () => { [N.G4, N.E4, N.D4, N.C4].forEach((f, i) => tone('sine', f, i * 0.2, 0.4, 0.22)); };
export const level = () => { [N.E5, N.G5, N.A5, N.C6].forEach((f, i) => tone('sine', f, i * 0.07, 0.18, 0.16)); };
export const tick = () => tone('square', 900, 0, 0.03, 0.07);
export const warn = () => { tone('square', 740, 0, 0.09, 0.1); tone('square', 740, 0.14, 0.09, 0.1); };

// ---- car sounds for the 3D scenes ----
export function horn() { tone('square', 392, 0, 0.45, 0.09); tone('square', 494, 0, 0.45, 0.09); }
export function brake() { noise(0, 0.7, 0.2, 2200, 5200); tone('sawtooth', [900, 380], 0, 0.6, 0.03); }
export function beep() { tone('sine', 1000, 0, 0.12, 0.14); }
export function bump() { tone('sine', [140, 50], 0, 0.25, 0.4); noise(0, 0.2, 0.25, 200, 900); }
// engine: a low sawtooth through a low-pass filter; set(0..1) raises pitch and loudness
export function engine() {
  const c = ac(); if (!c) return { set() {}, stop() {} };
  const o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0.0001;
  o.frequency.value = 55; o2.frequency.value = 27.5;
  o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start();
  const h = {
    set(x) { const v = Math.min(1, Math.max(0, x)), t = c.currentTime; o.frequency.setTargetAtTime(48 + v * 110, t, 0.08); o2.frequency.setTargetAtTime(24 + v * 55, t, 0.08); f.frequency.setTargetAtTime(380 + v * 900, t, 0.08); g.gain.setTargetAtTime(0.02 + v * 0.07, t, 0.08); },
    stop() { const t = c.currentTime; g.gain.setTargetAtTime(0.0001, t, 0.05); setTimeout(() => { try { o.stop(); o2.stop(); } catch {} }, 250); live.delete(h); },
  };
  live.add(h); h.set(0); return h;
}
// blinker: a steady tick-tock while on
export function blinker() {
  let on = true, flip = false;
  const run = () => { if (!on) return; tone('square', flip ? 1500 : 1150, 0, 0.025, 0.08); flip = !flip; setTimeout(run, 380); };
  const h = { stop() { on = false; live.delete(h); } }; live.add(h); run(); return h;
}
