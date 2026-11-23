// Sound effects. Interface sounds are synthesized with WebAudio; the car sounds of the 3D scenes use a few short real recordings (CC0, assets3d/audio)
// plus a synthesized electric drivetrain. Everything is same-origin and works offline.
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
// real recordings (assets3d/audio, see assets3d/LICENSE.txt); decoded once, a synthesized fallback is used if one cannot be loaded
const AUDIO = new URL('../assets3d/audio/', import.meta.url), bufs = new Map();
function sample(name) {
  const c = ac(); if (!c) return Promise.resolve(null);
  if (!bufs.has(name)) bufs.set(name, fetch(new URL(name + '.ogg', AUDIO)).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(b => new Promise((ok, no) => c.decodeAudioData(b, ok, no))).catch(() => { bufs.delete(name); return null; }));
  return bufs.get(name);
}
function play(name, { gain = 0.6, rate = 1, at = 0, loop = false, fade = 0.03, dur = 0 } = {}) {
  const c = ac(); if (!c) return null; let src = null, g = null, dead = false;
  sample(name).then(b => { if (!b || dead) return; src = c.createBufferSource(); src.buffer = b; src.loop = loop; src.playbackRate.value = rate; g = c.createGain();
    const t0 = c.currentTime + at; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + fade);
    if (dur) { g.gain.setValueAtTime(gain, t0 + Math.max(fade, dur - 0.15)); g.gain.linearRampToValueAtTime(0.0001, t0 + dur); }
    src.connect(g); g.connect(master); src.start(t0); if (dur) src.stop(t0 + dur + 0.05); });
  return { stop() { dead = true; if (g) { try { g.gain.setTargetAtTime(0.0001, ac().currentTime, 0.05); src.stop(ac().currentTime + 0.3); } catch {} } } };
}
export function preload() { for (const n of ['blink', 'door-close', 'door-open', 'squeal', 'traffic']) sample(n); }

// horn: two sawtooth voices (about 400 and 500 Hz, as a car horn pair) through a low-pass, with a short attack
export function horn() {
  const c = ac(); if (!c) return; const t0 = c.currentTime, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; f.Q.value = 0.8;
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.16, t0 + 0.03); g.gain.setValueAtTime(0.16, t0 + 0.42); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.52);
  for (const fr of [398, 503, 402, 507]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(t0); o.stop(t0 + 0.6); }
  f.connect(g); g.connect(master);
}
// braking: a real tyre squeal recording, rising in pitch as the car slows, plus a short low rumble
export function brake() { const h = play('squeal', { gain: 0.5, rate: 0.9, loop: true, dur: 0.95, fade: 0.08 }); if (!h) return; noise(0, 0.9, 0.12, 120, 900); if (!bufs.get('squeal')) { noise(0, 0.7, 0.2, 2200, 5200); } }
export function door(open = false) { play(open ? 'door-open' : 'door-close', { gain: 0.8 }); }
export function ambience(gain = 0.35) { const h = play('traffic', { gain, loop: true, fade: 0.6 }); if (!h) return { stop() {} }; live.add(h); const stop = h.stop; h.stop = () => { stop(); live.delete(h); }; return h; }
export function beep() { tone('sine', 1000, 0, 0.12, 0.14); }
export function bump() { tone('sine', [140, 50], 0, 0.25, 0.4); noise(0, 0.2, 0.25, 200, 900); }
// electric drivetrain (the cars in the scenes are electric): a soft motor whine that rises with speed, tyre and wind noise that grow with speed,
// and below about 20 km/h the low "pedestrian warning" hum that electric cars must make at low speed (it fades out above that). Silent when stopped.
// set(0..1) is the speed as a fraction of about 130 km/h.
let noiseBuf = null;
function loopNoise(c) { if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = (Math.random() * 2 - 1) * 0.6 + b * 6; } } const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }
export function engine() {
  const c = ac(); if (!c) return { set() {}, stop() {} };
  const mo = [c.createOscillator(), c.createOscillator(), c.createOscillator()], mg = c.createGain(), mf = c.createBiquadFilter(); mo[0].type = 'sine'; mo[1].type = 'triangle'; mo[2].type = 'sine';
  mf.type = 'lowpass'; mf.frequency.value = 3200; mg.gain.value = 0.0001; for (const o of mo) { o.connect(mf); o.start(); } mf.connect(mg); mg.connect(master);
  const road = loopNoise(c), rf = c.createBiquadFilter(), rg = c.createGain(); rf.type = 'bandpass'; rf.frequency.value = 600; rf.Q.value = 0.7; rg.gain.value = 0.0001; road.connect(rf); rf.connect(rg); rg.connect(master); road.start();
  const wind = loopNoise(c), wf = c.createBiquadFilter(), wg = c.createGain(); wf.type = 'lowpass'; wf.frequency.value = 380; wg.gain.value = 0.0001; wind.connect(wf); wf.connect(wg); wg.connect(master); wind.start(0, 0.7);
  const av = c.createOscillator(), av2 = c.createOscillator(), ag = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(); av.type = 'sine'; av2.type = 'sine'; ag.gain.value = 0.0001;
  lfo.frequency.value = 5.5; lg.gain.value = 0.35; lfo.connect(lg); lg.connect(ag.gain); av.connect(ag); av2.connect(ag); ag.connect(master); av.start(); av2.start(); lfo.start();
  const h = {
    set(x) { const v = Math.min(1, Math.max(0, x)), t = c.currentTime, fr = 160 + v * 1500;
      mo[0].frequency.setTargetAtTime(fr, t, 0.1); mo[1].frequency.setTargetAtTime(fr * 2.01, t, 0.1); mo[2].frequency.setTargetAtTime(fr * 3, t, 0.1);
      mg.gain.setTargetAtTime(v < 0.01 ? 0.0001 : 0.012 + 0.03 * Math.min(1, v * 2.5), t, 0.1);
      rf.frequency.setTargetAtTime(450 + v * 900, t, 0.1); rg.gain.setTargetAtTime(v < 0.01 ? 0.0001 : 0.015 + 0.2 * v, t, 0.12);
      wg.gain.setTargetAtTime(v * v * 0.22, t, 0.15);
      av.frequency.setTargetAtTime(240 + v * 900, t, 0.1); av2.frequency.setTargetAtTime((240 + v * 900) * 1.5, t, 0.1);
      ag.gain.setTargetAtTime(v < 0.01 ? 0.0001 : v < 0.16 ? 0.06 : Math.max(0.0001, 0.06 * (0.3 - v) / 0.14), t, 0.15); },
    stop() { const t = c.currentTime; for (const g of [mg, rg, wg, ag]) g.gain.setTargetAtTime(0.0001, t, 0.08); setTimeout(() => { for (const n of [...mo, road, wind, av, av2, lfo]) { try { n.stop(); } catch {} } }, 450); live.delete(h); },
  };
  live.add(h); h.set(0); return h;
}
// blinker: the real tick-tock recording, once per half cycle (2.6 flashes a second, as the lights in the scenes)
export function blinker() {
  let on = true; sample('blink');
  const run = () => { if (!on) return; if (bufs.get('blink')) play('blink', { gain: 0.9 }); else tone('square', 1150, 0, 0.025, 0.08); setTimeout(run, 385); };
  const h = { stop() { on = false; live.delete(h); } }; live.add(h); run(); return h;
}
