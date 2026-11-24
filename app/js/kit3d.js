// Shared 3D toolkit for the lesson scenes (three.js, bundled in vendor/, loaded only when a 3D view is opened).
// Real models (CC0, see assets3d/LICENSE.txt): Kenney vehicles, characters, trains; Public Transport bus. Roads, markings, signs and lights are built here
// so that every marking follows the Israeli road-marking rules the lessons cite.
//
// Conventions used by every scene
//  - units are metres; the road runs along -Z by default ("north"); the right-hand lane of a northbound road is x = +LANE.
//  - a vehicle at rotation.y = 0 drives toward -Z; rotation.y = Path heading (see Path.at) for other directions.
//  - heights: y = 0 is the road surface.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/jsm/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/jsm/SkeletonUtils.js';
import { RoomEnvironment } from '../vendor/jsm/RoomEnvironment.js';
import { buildEV } from './ev3d.js';
import { MeshoptDecoder } from '../vendor/jsm/meshopt_decoder.module.js';
import { h } from './ui.js';
import * as sfx from './sfx.js';

export { THREE, h, sfx };
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const ease = x => x * x * (3 - 2 * x);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const shortest = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const slowTo = (cur, goal, rate, dt) => { const d = goal - cur; return Math.abs(d) < 1e-3 ? goal : cur + Math.sign(d) * Math.min(Math.abs(d), rate * dt); };
export const LANE = 1.9;          // lane centre offset from the road centre line (a 3.8 m lane)
export const LANE_W = 3.8;

// deterministic pseudo-random so a scene always looks the same
export function rng(seed = 1) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- core: renderer, camera, orbit, loop, cleanup
export function core(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.3, 900);
  const pm = new THREE.PMREMGenerator(renderer); const envRT = pm.fromScene(new RoomEnvironment(), 0.04); scene.environment = envRT.texture;
  const view = { target: new THREE.Vector3(), yaw: 0.5, pitch: 0.6, dist: 40, goal: null, follow: null, driver: null, min: 6, max: 200 };
  const updaters = [], cleaners = [];
  let dead = false, raf = 0, seen = false, wait = 0, last = performance.now(), visible = true;

  const put = () => { const c = Math.cos(view.pitch); camera.position.set(view.target.x + view.dist * Math.sin(view.yaw) * c, view.target.y + view.dist * Math.sin(view.pitch), view.target.z + view.dist * Math.cos(view.yaw) * c); camera.lookAt(view.target); };
  const apply = dt => {
    if (view.driver) {                                     // bonnet view: the driver sits on the left, eyes ahead of the windscreen
      const g = view.driver, hd = g.rotation.y, e = g.userData.eye || [-0.5, 1.35, -0.6], c = Math.cos(hd), s = Math.sin(hd);
      const ex = e[0] * c + e[2] * s, ez = -e[0] * s + e[2] * c, fx = -Math.sin(hd), fz = -Math.cos(hd);
      camera.position.set(g.position.x + ex, g.position.y + e[1], g.position.z + ez); camera.lookAt(camera.position.x + fx * 20, g.position.y + e[1] - 0.25, camera.position.z + fz * 20); return; }
    if (view.follow) { const k = 1 - Math.pow(0.001, dt); view.target.z += (view.follow.z() - view.target.z) * k; if (view.follow.x) view.target.x += (view.follow.x() - view.target.x) * k; }
    if (view.goal) { const k = 1 - Math.pow(0.0005, dt), G = view.goal; view.yaw += shortest(view.yaw, G.yaw) * k; view.pitch += (G.pitch - view.pitch) * k; view.dist += (G.dist - view.dist) * k;
      if (G.target) view.target.lerp(G.target, k); if (Math.abs(shortest(view.yaw, G.yaw)) < 0.002 && Math.abs(G.dist - view.dist) < 0.05) view.goal = null; }
    put(); if (view.clampX != null) { camera.position.x = clamp(camera.position.x, -view.clampX, view.clampX); camera.lookAt(view.target); }
    if (view.avoid) { let moved = false; for (const a of view.avoid) { const dx = camera.position.x - a.x, dz = camera.position.z - a.z, d = Math.hypot(dx, dz); if (d < a.r && camera.position.y < (a.h ?? 30)) { const k = a.r / (d || 1e-3); camera.position.x = a.x + (d ? dx : 1) * k; camera.position.z = a.z + dz * k; moved = true; } } if (moved) camera.lookAt(view.target); }   // camera never enters the circles {x,z,r,h} (junction corner buildings)
  };
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => { if (!drag || view.driver) return; view.goal = null; view.yaw -= (e.clientX - drag.x) * 0.008; view.pitch = clamp(view.pitch + (e.clientY - drag.y) * 0.006, 0.06, 1.5); drag = { x: e.clientX, y: e.clientY }; });
  const up = () => { drag = null; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { if (view.driver) return; e.preventDefault(); view.goal = null; view.dist = clamp(view.dist * (e.deltaY > 0 ? 1.08 : 0.92), view.min, view.max); }, { passive: false });
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; }) : null; io?.observe(canvas);

  function dispose() {
    if (dead) return; dead = true; cancelAnimationFrame(raf); io?.disconnect();
    for (const f of cleaners) { try { f(); } catch {} }
    scene.traverse(o => { if (o.userData?.shared) return; o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { if (x.userData?.shared) return; x.map?.dispose?.(); x.dispose?.(); }); });
    envRT.dispose(); pm.dispose(); renderer.dispose(); try { renderer.forceContextLoss(); } catch {}
  }
  function frame(now) {
    if (dead) return;
    if (canvas.isConnected) seen = true; else if (seen || ++wait > 900) return dispose();
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (visible && canvas.clientWidth > 0) {
      const w = canvas.clientWidth, hh = canvas.clientHeight, pr = renderer.getPixelRatio();
      if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(hh * pr)) { renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix(); }
      for (const f of updaters) f(dt, now / 1000);
      apply(dt); renderer.render(scene, camera); C.frames++;
    }
    raf = requestAnimationFrame(frame);
  }
  const C = { THREE, scene, camera, renderer, view, pmrem: pm, envRT, frames: 0, onFrame: f => updaters.push(f), onDispose: f => cleaners.push(f), dispose };
  raf = requestAnimationFrame(frame);
  return C;
}

// ---------------------------------------------------------------- page structure shared with the 2D diagrams
export const chip = (label, on, onclick) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), onclick, text: label });
export const btn = (label, onclick, cls = 'btn small') => h('button', { type: 'button', class: cls, onclick, text: label });
export function chipGroup(items, cur, on) {   // items: [[key,label]]
  const chips = items.map(([k, l]) => chip(l, k === cur, () => { chips.forEach((c, j) => c.setAttribute('aria-pressed', String(items[j][0] === k))); sfx.click(); on(k); }));
  return h('div', { class: 'row tight' }, chips);
}
export function fig3(title, src, build) {
  const alt = h('p', { class: 'vz-alt', 'aria-live': 'polite' }), stage = h('div', { class: 'vz-stage vz3-stage' }), ctl = h('div', { class: 'vz-ctl' });
  const f = h('figure', { class: 'viz viz3', 'aria-label': title }, h('h3', { class: 'h3', text: title }), stage, ctl,
    h('figcaption', {}, h('span', { class: 'small muted', text: 'תיאור מילולי: ' }), alt, h('span', { class: 'small muted', text: src })));
  const canvas = document.createElement('canvas'); canvas.className = 'vz3-canvas'; canvas.setAttribute('aria-hidden', 'true');
  const loading = h('p', { class: 'vz3-loading small', text: 'טוען דגמי תלת-ממד…' });
  stage.append(canvas, h('p', { class: 'vz3-hint small muted', text: 'גרור עם העכבר כדי לסובב, גלגלת לזום' }), loading);
  let C; try { C = core(canvas); } catch (e) { stage.replaceChildren(h('p', { class: 'warn-note', text: 'לא ניתן להציג תלת-ממד במחשב הזה. אפשר לחזור לתצוגה הדו-ממדית.' })); return f; }
  const W = world(C); f.dataset.scene = title; f._C = C;
  W.track(Promise.resolve(build({ C, W, ctl, say: s => { alt.textContent = s; } })).catch(e => { console.error(e); stage.replaceChildren(h('p', { class: 'warn-note', text: 'שגיאה בטעינת הסצנה. אפשר לחזור לתצוגה הדו-ממדית.' })); }));   // an async build (e.g. fetching data) counts as loading, so data-ready means the scene exists
  W.whenReady(() => { loading.remove(); f.dataset.ready = '1'; });
  return f;
}

// small canvas label used for names, distances and ticks
export function label(text, { size = 1.3, bg = 'rgba(18,28,48,.85)', fg = '#fff' } = {}) {
  const c = document.createElement('canvas'), x = c.getContext('2d'), fs = 64; x.font = `700 ${fs}px Rubik, Arial, sans-serif`;
  const w = Math.ceil(x.measureText(text).width) + 48; c.width = w; c.height = fs + 36;
  x.font = `700 ${fs}px Rubik, Arial, sans-serif`; x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = bg; x.beginPath(); x.roundRect?.(0, 0, c.width, c.height, 28); if (!x.roundRect) x.rect(0, 0, c.width, c.height); x.fill();
  x.fillStyle = fg; x.fillText(text, c.width / 2, c.height / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(size * c.width / c.height, size, 1); s.renderOrder = 10; return s;
}

// ---------------------------------------------------------------- paths (lines + quadratic curves), sampled by distance
export class Path {
  constructor(segs) { this.segs = segs.map(s => ({ ...s, n: s.t === 'q' ? 24 : 1 })); this.pts = []; let acc = 0, prev = null;
    for (const s of this.segs) { const n = s.n; for (let i = (prev ? 1 : 0); i <= n; i++) { const u = i / n, p = s.t === 'q' ? this.q(s, u) : [s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u]; if (prev) acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]); this.pts.push({ p, s: acc }); prev = p; } }
    this.len = acc; }
  q(s, u) { const k = 1 - u; return [k * k * s.a[0] + 2 * k * u * s.c[0] + u * u * s.b[0], k * k * s.a[1] + 2 * k * u * s.c[1] + u * u * s.b[1]]; }
  at(d) { d = clamp(d, 0, this.len); const P = this.pts; let i = 1; while (i < P.length - 1 && P[i].s < d) i++; const a = P[i - 1], b = P[i], u = b.s > a.s ? (d - a.s) / (b.s - a.s) : 0;
    const x = a.p[0] + (b.p[0] - a.p[0]) * u, z = a.p[1] + (b.p[1] - a.p[1]) * u, dx = b.p[0] - a.p[0], dz = b.p[1] - a.p[1]; return { x, z, h: Math.atan2(-dx, -dz) }; }
}
export function place(obj, p) { obj.position.x = p.x; obj.position.z = p.z; obj.rotation.y = p.h; }

// ---------------------------------------------------------------- assets
const BASE = new URL('../assets3d/', import.meta.url);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();   // path -> Promise<gltf>; models are shared between scenes (geometry and materials are never disposed: userData.shared)
export function loadModel(path) {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(new URL(path + '.glb', BASE).href).then(g => {
    g.scene.traverse(o => { if (o.isMesh) { o.userData.shared = true; o.geometry.userData = { ...o.geometry.userData, shared: true }; for (const m of [].concat(o.material)) { m.userData.shared = true; m.envMapIntensity = 0.35; if (m.map) m.map.userData = { shared: true }; } } });
    return g; }).catch(e => { cache.delete(path); throw e; }));
  return cache.get(path);
}

// vehicle catalogue: file, real-world size (the model is scaled to this length and squeezed to this width; wheels keep their roundness),
// rot = turn that makes the model's front point to -Z, seats: eye position of the driver (local, front = -Z)
export const VEHICLES = {
  etron: { f: 'veh/car_ev_suv_01', L: 4.9, W: 2.0, rot: 0, lamps: { brake: /M5_RedLamp/, head: /M5_WhiteLight/ } },
  su7: { f: 'veh/car_ev_saloon_01', L: 5.0, W: 2.0, rot: 0 },
  polestar: { f: 'veh/car_ev_saloon_02', L: 4.6, W: 1.9, rot: Math.PI, lamps: { brake: /red_glass/ } },
  hatch: { f: 'veh/car_hatch_01', L: 3.65, W: 1.74, rot: 0, lamps: { brake: /taillights/, head: /headlights/ }, fb: 'k:hatch' },
  suv: { f: 'veh/car_suv_01', L: 4.9, W: 2.0, rot: 0, fb: 'k:suv' },
  pickup: { f: 'veh/car_pickup_01', L: 5.2, W: 2.0, rot: 0, fb: 'k:pickup' },
  taxi: { f: 'veh/car_taxi_01', L: 4.9, W: 1.95, rot: 0, fb: 'k:taxi' },
  police: { f: 'veh/car_police_01', L: 5.2, W: 1.9, rot: Math.PI, lamps: { brake: /^brake$/ }, fb: 'k:police' },
  ambulance: { f: 'veh/car_ambulance_01', L: 5.6, W: 2.4, rot: 0, fb: 'k:ambulance' },
  van: { f: 'veh/van_minibus_01', L: 5.6, W: 2.1, rot: Math.PI, fb: 'k:van' },
  delivery: { f: 'veh/van_delivery_01', L: 5.9, W: 2.2, rot: 0, fb: 'k:delivery' },
  lorry: { f: 'veh/truck_box_01', L: 7.2, W: 2.4, rot: Math.PI, fb: 'k:lorry' },
  semi: { f: 'veh/truck_semi_01', L: 6.4, W: 2.55, rot: 0, lamps: { brake: /Red_Light_Back/, head: /White_Light/ } },
  firetruck: { f: 'veh/truck_fire_01', L: 9.0, W: 2.5, rot: 0, fb: 'k:firetruck' },
  bus: { f: 'veh/bus_city_01', L: 11.8, W: 2.55, rot: 0 },
  tractor: { f: 'veh/tractor_01', L: 3.9, W: 2.66, rot: 0, fb: 'k:tractor' },
  sedan: { f: 'cars/sedan', L: 4.3, W: 1.85, rot: Math.PI }, sports: { f: 'cars/sedan-sports', L: 4.4, W: 1.85, rot: Math.PI }, 'k:hatch': { f: 'cars/hatchback-sports', L: 4.0, W: 1.8, rot: Math.PI },
  'k:suv': { f: 'cars/suv', L: 4.6, W: 1.95, rot: Math.PI }, suvlux: { f: 'cars/suv-luxury', L: 4.8, W: 1.95, rot: Math.PI }, 'k:van': { f: 'cars/van', L: 4.8, W: 1.95, rot: Math.PI },
  evm3: { f: 'cars/ev-m3', L: 4.69, W: 2.1, rot: 0, paint: 'paint', ownLamps: true, fallback: true },
  'k:taxi': { f: 'cars/taxi', L: 4.5, W: 1.85, rot: Math.PI }, 'k:police': { f: 'cars/police', L: 5.0, W: 1.9, rot: Math.PI }, 'k:ambulance': { f: 'cars/ambulance', L: 5.6, W: 2.0, rot: Math.PI },
  'k:firetruck': { f: 'cars/firetruck', L: 8.0, W: 2.5, rot: Math.PI }, 'k:delivery': { f: 'cars/delivery', L: 6.4, W: 2.2, rot: Math.PI }, 'k:pickup': { f: 'cars/truck', L: 5.0, W: 1.95, rot: Math.PI },
  'k:lorry': { f: 'cars/garbage-truck', L: 8.5, W: 2.5, rot: Math.PI }, 'k:tractor': { f: 'cars/tractor', L: 3.6, W: 1.9, rot: Math.PI },
  train: { f: 'rail/train-electric-city-a', L: 14, W: 3.0, rot: Math.PI }, loco: { f: 'rail/train-locomotive-a', L: 14, W: 3.0, rot: Math.PI },
};
const EV_MODELS = ['evm3', 'polestar', 'etron', 'su7'];
const EV_PAINT = [0x6c7077, 0xe9ecef, 0x2b4a8c, 0xb3262e, 0x1c1e22, 0x9aa3ad]; let evCount = 0;   // electric cars get different paint in turn
const PEOPLE = ['character-male-a', 'character-male-b', 'character-male-c', 'character-male-d', 'character-male-e', 'character-male-f', 'character-female-a', 'character-female-b', 'character-female-c', 'character-female-d', 'character-female-e', 'character-female-f'];

// ---------------------------------------------------------------- textures drawn here (no image downloads)
const texCache = new Map();
function canvasTex(key, w, h2, draw, repeat) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h2; draw(c.getContext('2d'), w, h2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.userData = { shared: true }; texCache.set(key, t); return t;
}
const noise = (x, w, h2, n, col, a, r) => { for (let i = 0; i < n; i++) { x.fillStyle = col.replace('A', (r() * a).toFixed(3)); const s = 1 + r() * 2.5; x.fillRect(r() * w, r() * h2, s, s); } };
const asphaltTex = () => canvasTex('asphalt', 512, 512, (x, w, h2) => { const r = rng(7); x.fillStyle = '#42454b'; x.fillRect(0, 0, w, h2);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,0'},${(r() * .05).toFixed(3)})`; x.beginPath(); x.arc(r() * w, r() * h2, 20 + r() * 60, 0, 7); x.fill(); }
  noise(x, w, h2, 5000, 'rgba(255,255,255,A)', .22, r); noise(x, w, h2, 5000, 'rgba(0,0,0,A)', .35, r); });
// real sky (Poly Haven HDRI "Kloofendal 48d Partly Cloudy", CC0): reflections on the cars and the background of daytime scenes
let hdrP = {};
const skyHDR = kind => (hdrP[kind] ||= import('../vendor/jsm/RGBELoader.js').then(m => new m.RGBELoader().loadAsync(new URL('../assets3d/tex/sky-' + kind + '.hdr', import.meta.url).href)).then(t => { t.mapping = THREE.EquirectangularReflectionMapping; return t; }).catch(e => { delete hdrP[kind]; throw e; }));
// real PBR asphalt (Poly Haven "Asphalt 02", CC0): diffuse / normal / roughness, loaded once and shared
const pbrCache = new Map();
function pbrSet(name) {       // assets3d/tex/<name>-diff|nor|rough.jpg, loaded once and shared
  if (pbrCache.has(name)) return pbrCache.get(name); const tl = new THREE.TextureLoader(), u = n => new URL('../assets3d/tex/' + name + '-' + n + '.jpg', import.meta.url).href;
  const ld = (n, srgb) => tl.loadAsync(u(n)).then(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.userData = { shared: true }; return t; });
  const p = Promise.all([ld('diff', true), ld('nor'), ld('rough')]).then(([diff, nor, rough]) => ({ diff, nor, rough })).catch(e => { pbrCache.delete(name); throw e; }); pbrCache.set(name, p); return p;
}
const asphaltPBR = () => pbrSet('asphalt');
// gives a material the shared PBR maps of a set, tiled `rep` times (the clones are made after loading, so they always carry image data)
function applyPBR(mat, name, rep, track) {
  const job = pbrSet(name).then(T => { const tx = t => { const c = t.clone(); c.repeat.set(rep[0], rep[1]); c.needsUpdate = true; return c; }; mat.color.set(0xffffff); mat.map = tx(T.diff); mat.normalMap = tx(T.nor); mat.roughnessMap = tx(T.rough); mat.roughness = 1; mat.needsUpdate = true; }).catch(() => {});
  track?.(job); return mat;
}
const grassTex = () => canvasTex('grass', 512, 512, (x, w, h2) => { const r = rng(11); x.fillStyle = '#6a9a4a'; x.fillRect(0, 0, w, h2);
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${r() < .5 ? '40,90,30' : '150,190,90'},${(r() * .12).toFixed(3)})`; x.beginPath(); x.arc(r() * w, r() * h2, 14 + r() * 50, 0, 7); x.fill(); }
  noise(x, w, h2, 6000, 'rgba(30,80,20,A)', .35, r); noise(x, w, h2, 3000, 'rgba(190,220,120,A)', .3, r); });
const paveTex = () => canvasTex('pave', 256, 256, (x, w, h2) => { const r = rng(5); x.fillStyle = '#c9c4b8'; x.fillRect(0, 0, w, h2);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,0'},${(r() * .06).toFixed(3)})`; x.fillRect(i * 64, j * 64, 64, 64); }
  x.strokeStyle = 'rgba(70,66,58,.55)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h2); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); }
  noise(x, w, h2, 1500, 'rgba(0,0,0,A)', .2, r); });
const skyTex = (top, mid, bot) => { const c = document.createElement('canvas'); c.width = 8; c.height = 256; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(.55, mid); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 8, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

const stdMat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
const shadows = (o, cast = true, recv = true) => { o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); return o; };
export const mat = stdMat;

// ================================================================ the world bound to one core()
export function world(C) {
  const { scene } = C; const pending = new Set(); const readyCbs = []; let allDone = false;
  const track = p => { pending.add(p); const fin = () => { pending.delete(p); if (!pending.size && !allDone) { allDone = true; readyCbs.splice(0).forEach(f => f()); } }; p.then(fin, fin); return p; };
  const mixers = []; C.onFrame(dt => { for (const m of mixers) m.update(dt); });
  const W = { C, scene, track, whenReady(f) { if (!pending.size) { allDone = true; f(); } else readyCbs.push(f); },

    // ---------- sky, light, ground
    env({ ground = 'grass', size = 160, sky = 'day', fog = true, sunDir = [30, 55, 22], shadowSize = 70 } = {}) {
      const night = sky === 'night', dusk = sky === 'dusk';
      const [a, b, c] = night ? ['#070b18', '#1a2540', '#2a3350'] : dusk ? ['#6d86b8', '#f0b48a', '#f6d8a8'] : ['#5b9be0', '#a9cdf0', '#e4f0fa'];
      scene.background = skyTex(a, b, c); if (fog) scene.fog = new THREE.Fog(new THREE.Color(c), 140, 520);
      track(skyHDR(night ? 'night' : dusk ? 'dusk' : 'day').then(tex => { if (C.disposed) return; const rt = C.pmrem.fromEquirectangular(tex); C.envRT.dispose(); C.envRT = rt; scene.environment = rt.texture; scene.background = tex; scene.backgroundBlurriness = 0.02; if (!night && !dusk) scene.fog?.color.set(0xcfdceb); }).catch(() => {}));
      const hemi = new THREE.HemisphereLight(night ? 0x5a6cae : 0xdfeaff, night ? 0x1b2216 : 0x6d7f55, night ? 0.5 : 1.05); scene.add(hemi);
      const sun = new THREE.DirectionalLight(night ? 0x8fa3ff : dusk ? 0xffd2a0 : 0xfff3e0, night ? 0.35 : 2.4); sun.position.set(...sunDir); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -shadowSize; sc.right = shadowSize; sc.top = shadowSize; sc.bottom = -shadowSize; sc.near = 1; sc.far = 220; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
      scene.add(sun, sun.target); W.sun = sun; if (night) C.renderer.toneMappingExposure = 0.9;
      const gm = new THREE.MeshStandardMaterial({ color: ground === 'grass' ? 0x6f9c52 : 0xb9b29c, roughness: 1 });
      if (ground === 'grass') applyPBR(gm, 'grass', [size * 4 / 3, size * 4 / 3], track);      // real lawn texture (ambientCG, CC0) over a plain green until it has loaded
      const g = new THREE.Mesh(new THREE.PlaneGeometry(size * 4, size * 4), gm);
      g.rotation.x = -Math.PI / 2; g.position.y = -0.02; g.receiveShadow = true; scene.add(g); W.ground = g; return W;
    },
    followSun(x, z) { W.sun.position.set(x + 30, 55, z + 22); W.sun.target.position.set(x, 0, z); },

    // ---------- road surface and markings
    asphalt(x, z, w, d, { y = 0.012, ry = 0 } = {}) { const rep = [w / 5, d / 5];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x4b4e54, roughness: 0.9, metalness: 0, envMapIntensity: 0.6 }));
      applyPBR(m.material, 'asphalt', rep, track); m.material.normalScale?.set(0.9, 0.9);
      m.rotation.x = -Math.PI / 2; m.rotation.z = ry; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; },
    flat(x, z, w, d, color, { y = 0.03, opacity = 1, emissive = 0, ry = 0, rough = 0.7 } = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: rough, transparent: opacity < 1, opacity, emissive, emissiveIntensity: emissive ? 0.6 : 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: opacity >= 1 }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = ry; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; },
    line(x, z0, z1, { w = 0.16, color = 0xf4f4f0, y = 0.03 } = {}) { return W.flat(x, (z0 + z1) / 2, w, Math.abs(z1 - z0), color, { y }); },          // solid line along Z
    lineX(z, x0, x1, { w = 0.16, color = 0xf4f4f0, y = 0.03 } = {}) { return W.flat((x0 + x1) / 2, z, Math.abs(x1 - x0), w, color, { y }); },        // solid line along X
    dashes(x, z0, z1, { w = 0.16, len = 3, gap = 6, color = 0xf4f4f0, y = 0.03 } = {}) { const a = Math.min(z0, z1), b = Math.max(z0, z1), out = []; for (let z = a; z + len <= b + 1e-6; z += len + gap) out.push(W.flat(x, z + len / 2, w, len, color, { y })); return out; },
    dashesX(z, x0, x1, { w = 0.16, len = 3, gap = 6, color = 0xf4f4f0, y = 0.03 } = {}) { const a = Math.min(x0, x1), b = Math.max(x0, x1), out = []; for (let x = a; x + len <= b + 1e-6; x += len + gap) out.push(W.flat(x + len / 2, z, len, w, color, { y })); return out; },
    // pedestrian crossing: white bars parallel to the traffic (road runs along Z when alongZ), width across the road
    zebra(cx, cz, acrossW, { alongZ = true, bar = 0.5, gap = 0.5, depth = 3 } = {}) { const n = Math.floor(acrossW / (bar + gap)), x0 = -((n - 1) * (bar + gap)) / 2, out = [];
      for (let i = 0; i < n; i++) { const o = x0 + i * (bar + gap); out.push(alongZ ? W.flat(cx + o, cz, bar, depth, 0xf4f4f0, { y: 0.032 }) : W.flat(cx, cz + o, depth, bar, 0xf4f4f0, { y: 0.032 })); } return out; },
    stopLine(cx, cz, len, { alongZ = false } = {}) { return alongZ ? W.flat(cx, cz, 0.45, len, 0xf4f4f0, { y: 0.032 }) : W.flat(cx, cz, len, 0.45, 0xf4f4f0, { y: 0.032 }); },
    // "teeth" (give way line): row of triangles pointing toward the approaching driver; dir = +1 means the driver comes from +Z (heading -Z)
    teeth(cx, cz, len, { dir = 1, alongX = false } = {}) { const n = Math.round(len / 0.9), g = new THREE.Group(); const sh = new THREE.Shape(); sh.moveTo(-0.4, 0); sh.lineTo(0.4, 0); sh.lineTo(0, 0.7); sh.closePath();
      const geo = new THREE.ShapeGeometry(sh); const m = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      for (let i = 0; i < n; i++) { const t = new THREE.Mesh(geo, m); t.rotation.x = -Math.PI / 2; t.position.set(-len / 2 + (i + 0.5) * (len / n), 0.033, 0); t.rotation.z = Math.PI; g.add(t); }
      g.position.set(cx, 0, cz); if (alongX) g.rotation.y = Math.PI / 2; if (dir < 0) g.rotation.y += Math.PI; scene.add(g); g.traverse(o => { o.receiveShadow = true; }); return g; },
    arrow(x, z, { heading = 0, color = 0xf4f4f0 } = {}) { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color, roughness: .7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const sh = new THREE.Shape(); sh.moveTo(0, 1.6); sh.lineTo(0.6, 0.6); sh.lineTo(0.2, 0.6); sh.lineTo(0.2, -1.6); sh.lineTo(-0.2, -1.6); sh.lineTo(-0.2, 0.6); sh.lineTo(-0.6, 0.6); sh.closePath();
      const a = new THREE.Mesh(new THREE.ShapeGeometry(sh), m); a.rotation.x = -Math.PI / 2; a.position.y = 0.034; g.add(a); g.position.set(x, 0, z); g.rotation.y = heading; scene.add(g); return g; },
    // raised kerb + pavement strip (light paving), top at 0.16
    kerb(x, z, w, d, { color = 0xc9c4b8, h: hh = 0.16 } = {}) {
      const top = new THREE.MeshStandardMaterial({ color: 0xc9c4b8, roughness: .9 }), side = new THREE.MeshStandardMaterial({ color: 0xb8b3a6, roughness: .9 });
      applyPBR(top, 'pave', [Math.max(1, w / 1.6), Math.max(1, d / 1.6)], track);               // real paving (ambientCG, CC0)
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), [side, side, top, side, side, side]); m.position.set(x, hh / 2, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; },
    box(x, y, z, w, hh, d, color, o = {}) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), stdMat(color, o)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; },
    // a straight two-way road along Z: lanes each way, kerbs and pavements on both sides, white edge + centre line (dashed or solid)
    roadZ({ x = 0, z0 = -120, z1 = 120, lanes = 1, pave = 4, centre = 'dash', edge = true, kerbs = true } = {}) {
      const w = lanes * 2 * LANE_W, len = Math.abs(z1 - z0), cz = (z0 + z1) / 2; W.asphalt(x, cz, w, len);
      if (edge) { W.line(x - w / 2 + 0.25, z0, z1); W.line(x + w / 2 - 0.25, z0, z1); }
      for (let l = 1; l < lanes; l++) for (const s of [-1, 1]) W.dashes(x + s * l * LANE_W, z0, z1);
      if (centre === 'dash') W.dashes(x, z0, z1); else if (centre === 'solid') W.line(x, z0, z1);
      if (kerbs) { W.kerb(x - w / 2 - pave / 2, cz, pave, len); W.kerb(x + w / 2 + pave / 2, cz, pave, len); }
      return { width: w, left: x - w / 2, right: x + w / 2 }; },
    roadX({ z = 0, x0 = -120, x1 = 120, lanes = 1, pave = 4, centre = 'dash', edge = true, kerbs = true } = {}) {
      const w = lanes * 2 * LANE_W, len = Math.abs(x1 - x0), cx = (x0 + x1) / 2; W.asphalt(cx, z, len, w);
      if (edge) { W.lineX(z - w / 2 + 0.25, x0, x1); W.lineX(z + w / 2 - 0.25, x0, x1); }
      for (let l = 1; l < lanes; l++) for (const s of [-1, 1]) W.dashesX(z + s * l * LANE_W, x0, x1);
      if (centre === 'dash') W.dashesX(z, x0, x1); else if (centre === 'solid') W.lineX(z, x0, x1);
      if (kerbs) { W.kerb(cx, z - w / 2 - pave / 2, len, pave); W.kerb(cx, z + w / 2 + pave / 2, len, pave); }
      return { width: w, top: z - w / 2, bottom: z + w / 2 }; },

    // ---------- vehicles
    vehicle(key, { name, tint, night = false } = {}) {
      if (key === 'schoolbus') return W.bus({ school: key === 'schoolbus', color: tint, name });
      if (key === 'ev' || key === 'evsedan') { const pick = EV_MODELS[evCount % EV_MODELS.length]; key = pick; if (key === 'evm3') tint = tint ?? EV_PAINT[Math.floor(evCount / EV_MODELS.length) % EV_PAINT.length]; evCount++; }   // electric cars take turns; js/ev3d.js is the fallback
      const spec = VEHICLES[key] || VEHICLES.sedan, g = new THREE.Group(); g.name = name || key; g.userData = { key, brake: [], blink: { L: [], R: [] }, head: [], blinkSide: null, eye: [-0.5, 1.4, -spec.L * 0.18], dims: { L: spec.L, W: spec.W, H: 1.6 }, wheels: [] };
      const inner = new THREE.Group(); g.add(inner);
      const tryLoad = async () => { for (const sp of [spec, ...(spec.fb ? [VEHICLES[spec.fb]] : [])]) { try { return [sp, await loadModel(sp.f)]; } catch {} } throw new Error('model'); };
      const p = tryLoad().then(([spec, gl]) => {
        const m = gl.scene.clone(true); const b = new THREE.Box3().setFromObject(m), sz = b.getSize(new THREE.Vector3());
        const rotated = Math.abs(Math.sin(spec.rot)) > 0.5;                       // length is along X in the file
        const len = rotated ? sz.x : sz.z, wid = rotated ? sz.z : sz.x, s = spec.L / len, sx = spec.W / wid;   // sx: width squeeze, in the file's width axis
        const wrap = new THREE.Group(); m.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); wrap.add(m);
        wrap.scale.set(rotated ? s : sx, s, rotated ? sx : s); const outer = new THREE.Group(); outer.add(wrap); outer.rotation.y = spec.rot; inner.add(outer);
        // cars of the same file get different colours through a light tint on the body material only
        const H = sz.y * s; g.userData.dims.H = H; g.userData.eye = [-spec.W * 0.25, H * 0.95, -spec.L * 0.42];     // bonnet view: just behind the nose, so the (opaque) cabin never fills the picture
        if (spec.paint) wrap.traverse(o => { if (!o.isMesh) return; if (o.material.name === spec.paint) { const c = new THREE.MeshPhysicalMaterial({ color: tint || 0xdddddd, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 }); c.name = spec.paint; o.material = c; } else { const m = o.material = o.material.clone(); m.userData = {}; m.envMapIntensity = 0.9;
          if (spec.lamps) { const n = m.name, on = (list, col, ei) => { m.emissive = new THREE.Color(col); m.emissiveIntensity = ei; list.push(m); };
            if (spec.lamps.brake?.test(n)) on(g.userData.brake, 0xff1a1a, 0.1); else if (spec.lamps.head?.test(n)) on(g.userData.head, 0xfff2d0, night ? 2.2 : 0.2); }
          if (spec.ownLamps) {                       // the model's own lights are driven through their material's emissive colour
            const n = m.name, on = (list, col, ei) => { m.emissive = new THREE.Color(col); m.emissiveIntensity = ei; list.push(m); };
            if (/rear light|breaklight|pantulan/i.test(n)) on(g.userData.brake, 0xff1a1a, 0.1); else if (/front light/i.test(n)) on(g.userData.head, 0xfff2d0, night ? 2.2 : 0.2);
            else if (/indicator l/i.test(n)) on(g.userData.blink.L, 0xffa000, 0); else if (/indicator r/i.test(n)) on(g.userData.blink.R, 0xffa000, 0); } } });
        else if (tint) wrap.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.userData = {}; o.material.color.set(tint); } });
        shadows(outer);
        if (spec.ownLamps) return;
        const needBrake = !g.userData.brake.length, needHead = !g.userData.head.length;
        const mk = (c, em, ei) => new THREE.MeshStandardMaterial({ color: c, emissive: em, emissiveIntensity: ei, roughness: .4 });
        const zr = spec.L / 2 + 0.015, zy = spec.lampY ?? Math.max(0.5, H * 0.38), zyH = spec.headY ?? zy, xs = spec.lampX ?? spec.W * 0.33;
        const add = (mm, x, z, sw, sh, yy = zy) => { const q = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.06), mm); q.position.set(x, yy, z); inner.add(q); return q; };
        if (needBrake) for (const sgn of [-1, 1]) { const bm = mk(0x7a1010, 0xff1a1a, 0.1); add(bm, sgn * xs, zr - 0.05, 0.3, 0.1); g.userData.brake.push(bm); }
        if (needHead) for (const sgn of [-1, 1]) { const hm = mk(0xfff6cf, 0xfff2b0, night ? 2.2 : 0.25); add(hm, sgn * xs, -zr + 0.05, 0.3, 0.1, zyH); g.userData.head.push(hm); }
        for (const [side, sgn] of [['L', -1], ['R', 1]]) for (const zz of [-zr, zr]) { const bm = mk(0x6a4300, 0xffa000, 0); add(bm, sgn * (spec.W / 2 - 0.12), zz - Math.sign(zz) * 0.05, 0.16, 0.09); g.userData.blink[side].push(bm); }
      }).catch(() => {                                                            // fallback: the built-in electric car, or a simple box car, so the scene still works
        if (spec.fallback) { const e = buildEV({ color: tint ?? 0x6c7077 }); Object.assign(g.userData, { brake: e.userData.brake, head: e.userData.head, blink: e.userData.blink, eye: e.userData.eye, dims: e.userData.dims }); inner.add(e); return; }
        const body = new THREE.Mesh(new THREE.BoxGeometry(spec.W, 1.0, spec.L), stdMat(tint || 0x4a7fd0, { roughness: .5 })); body.position.y = 0.8; inner.add(shadows(body)); });
      track(p); return g; },
    // city bus built here (the free bus models are untextured); front = -Z, doors on the right side
    bus({ color, school = false, name } = {}) {
      const L = 11.6, Wd = 2.5, g = new THREE.Group(); g.name = name || 'bus'; g.userData = { key: 'bus', brake: [], blink: { L: [], R: [] }, head: [], blinkSide: null, eye: [-0.6, 2.3, -L * 0.42], dims: { L, W: Wd, H: 3.1 }, wheels: [] };
      const c = color ?? (school ? 0xf2b705 : 0x2b7fb8), body = stdMat(c, { roughness: .45, metalness: .15 }), glass = stdMat(0x1c2b3a, { roughness: .12, metalness: .5 }), dark = stdMat(0x23262b, { roughness: .7 }), white = stdMat(0xeef0f2, { roughness: .5 });
      const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
      add(new THREE.BoxGeometry(Wd, 2.55, L), body, 0, 1.75, 0);                                   // body
      add(new THREE.BoxGeometry(Wd + 0.04, 0.5, L + 0.04), dark, 0, 0.62, 0);                      // skirt
      add(new THREE.BoxGeometry(Wd - 0.3, 0.12, L - 1.0), school ? body : white, 0, 3.08, 0.2);    // roof panel
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.95, L - 2.6), glass, sx * (Wd / 2 + 0.01), 2.2, 0.5);     // side windows
      add(new THREE.BoxGeometry(Wd - 0.22, 1.05, 0.03), glass, 0, 2.2, -L / 2 - 0.01);              // windscreen
      add(new THREE.BoxGeometry(Wd - 0.22, 0.55, 0.03), glass, 0, 2.2, L / 2 + 0.01);                // rear window
      add(new THREE.BoxGeometry(0.02, 1.75, 1.15), dark, Wd / 2 + 0.012, 1.55, -L * 0.28);           // front door (right)
      if (!school) add(new THREE.BoxGeometry(0.02, 1.75, 1.15), dark, Wd / 2 + 0.012, 1.55, L * 0.08); // middle door
      const sign = new THREE.MeshStandardMaterial({ color: 0x302000, emissive: 0xffa000, emissiveIntensity: 0.9 }); add(new THREE.BoxGeometry(1.3, 0.22, 0.03), sign, 0, 2.95, -L / 2 - 0.02);
      for (const [z, r] of [[-L * 0.33, 0.52], [L * 0.28, 0.52]]) for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 20), stdMat(0x15161a, { roughness: .8 })); w.rotation.z = Math.PI / 2; w.position.set(sx * (Wd / 2 - 0.12), r, z); w.castShadow = true; g.add(w); g.userData.wheels.push(w);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * .55, r * .55, 0.32, 14), stdMat(0xa8afb8, { metalness: .6, roughness: .35 })); hub.rotation.z = Math.PI / 2; hub.position.copy(w.position); g.add(hub); }
      const lamp = (cc, em, ei, x, y, z, sw, sh) => { const m = new THREE.MeshStandardMaterial({ color: cc, emissive: em, emissiveIntensity: ei, roughness: .3 }); add(new THREE.BoxGeometry(sw, sh, 0.06), m, x, y, z); return m; };
      for (const sx of [-1, 1]) { g.userData.head.push(lamp(0xfff6cf, 0xfff2b0, 0.25, sx * 0.85, 0.95, -L / 2 - 0.02, 0.45, 0.22)); g.userData.brake.push(lamp(0x7a1010, 0xff1a1a, 0.1, sx * 0.85, 1.0, L / 2 + 0.02, 0.4, 0.2)); }
      for (const [side, sx] of [['L', -1], ['R', 1]]) for (const zz of [-L / 2 - 0.02, L / 2 + 0.02]) g.userData.blink[side].push(lamp(0x6a4300, 0xffa000, 0, sx * (Wd / 2 - 0.15), 0.95, zz, 0.28, 0.16));
      return g; },
    setBrake(car, on) { for (const m of car.userData.brake) m.emissiveIntensity = on ? 2.2 : 0.1; },
    setBlinker(car, side) { car.userData.blinkSide = side; },
    blinkTick(car, now) { const s = car.userData.blinkSide, on = s && Math.floor(now * 2.6) % 2 === 0; for (const side of ['L', 'R']) for (const m of car.userData.blink[side]) m.emissiveIntensity = on && side === s ? 2.4 : 0; },
    setHeadlights(car, on) { for (const m of car.userData.head) m.emissiveIntensity = on ? 2.4 : 0.25; },
    label(car, text, o = {}) { const l = label(text, o); l.position.set(0, (car.userData.dims?.H || 1.6) + 1.3, 0); car.add(l); return l; },

    // motorcycle built here (no free model of a normal motorcycle in the same style); front = -Z; rider optional
    moto({ color = 0xc9341f, rider = true, riderIndex = 2 } = {}) {
      const g = new THREE.Group(); g.userData = { key: 'moto', brake: [], blink: { L: [], R: [] }, head: [], blinkSide: null, eye: [-0.0, 1.55, -0.7], dims: { L: 2.1, W: 0.8, H: 1.1 }, wheels: [] };
      const tire = stdMat(0x17181b, { roughness: .8 }), metal = stdMat(0xa8afb8, { metalness: .6, roughness: .35 }), body = stdMat(color, { roughness: .35, metalness: .25 }), dark = stdMat(0x25272c, { roughness: .6 });
      const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
      for (const z of [-0.72, 0.68]) { const w = new THREE.Group(); w.position.set(0, 0.34, z); const t = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.085, 10, 28), tire); t.rotation.y = Math.PI / 2; const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 18), metal); hub.rotation.z = Math.PI / 2; w.add(t, hub); w.traverse(o => { o.castShadow = true; }); g.add(w); g.userData.wheels.push(w); }
      add(new THREE.BoxGeometry(0.3, 0.3, 0.62), dark, 0, 0.5, 0.05);                                   // engine
      add(new THREE.CapsuleGeometry(0.17, 0.36, 6, 12), body, 0, 0.84, -0.22, Math.PI / 2, 0, 0);       // tank
      add(new THREE.BoxGeometry(0.26, 0.1, 0.62), dark, 0, 0.78, 0.4);                                  // seat
      add(new THREE.BoxGeometry(0.24, 0.08, 0.5), body, 0, 0.62, 0.88, 0.25, 0, 0);                       // tail
      for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.78, 8), metal, sx * 0.1, 0.72, -0.62, -0.38, 0, 0);   // fork
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.74, 8), metal, 0, 1.08, -0.74, 0, 0, Math.PI / 2);   // handlebar
      add(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 10), metal, 0.2, 0.38, 0.55, Math.PI / 2, 0, 0);    // exhaust
      add(new THREE.BoxGeometry(0.22, 0.04, 0.55), body, 0, 0.62, -0.72);                                // front mudguard
      const lamp = (c, em, ei, x, y, z, sz = 0.14) => { const m = new THREE.MeshStandardMaterial({ color: c, emissive: em, emissiveIntensity: ei, roughness: .3 }); add(new THREE.SphereGeometry(sz / 2, 10, 8), m, x, y, z); return m; };
      g.userData.head.push(lamp(0xfff6cf, 0xfff2b0, 0.25, 0, 0.98, -0.86, 0.26)); g.userData.brake.push(lamp(0x7a1010, 0xff1a1a, 0.1, 0, 0.7, 1.15, 0.14));
      for (const [side, sx] of [['L', -1], ['R', 1]]) { g.userData.blink[side].push(lamp(0x6a4300, 0xffa000, 0, sx * 0.38, 1.08, -0.74), lamp(0x6a4300, 0xffa000, 0, sx * 0.14, 0.7, 1.15)); }
      if (rider) { const p = W.person(riderIndex, { anim: 'sit', height: 1.55 }); p.position.set(0, 0.2, 0.28); g.add(p); g.userData.rider = p; }
      return g; },

    // ---------- people (animated; anim: 'walk' | 'idle' | 'sprint' | 'sit')
    // a model fitted to a real-world height, standing on y = 0, centred on (x, z); static (no animation)
    fit(path, { h: hh = 1, x = 0, z = 0, ry = 0, dropFlat = false, fallback, fbScale = 1 } = {}) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      track(loadModel(path).then(gl => { const m = gl.scene.clone(true);
        if (dropFlat) { const b0 = new THREE.Box3().setFromObject(m), H = b0.max.y - b0.min.y, rm = [];
          m.traverse(o => { if (o.isMesh) { const b = new THREE.Box3().setFromObject(o); if (b.max.y - b.min.y < 0.05 * H && b.max.x - b.min.x > 0.2 * H) rm.push(o); } }); rm.forEach(o => o.parent.remove(o)); }
        const b = new THREE.Box3().setFromObject(m), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), w = new THREE.Group();
        m.position.set(-c.x, -b.min.y, -c.z); w.add(m); w.scale.setScalar(hh / Math.max(0.001, sz.y)); shadows(w); g.add(w);
      }).catch(() => { if (!fallback) return; return loadModel(fallback).then(gl => { const m = gl.scene.clone(true); m.scale.setScalar(fbScale); shadows(m); g.add(m); }).catch(() => {}); }));
      return g; },
    // Israeli street trees: palms, potted cypress and the stylised trees, in turn
    streetTree(r, { x, z }) { const k = r();
      if (k < 0.35) return W.fit('prop2/palm_tall_01', { h: 8.5 + r() * 3, x, z, ry: r() * 6, dropFlat: true, fallback: 'city/tree-large', fbScale: 9 });
      if (k < 0.5) return W.fit('prop2/cypress_01', { h: 6 + r() * 2, x, z, ry: r() * 6, fallback: 'city/tree-small', fbScale: 9 });
      return W.prop(r() < 0.5 ? 'city/tree-large' : 'city/tree-small', { scale: 8 + r() * 3, x, z, ry: r() * 6 }); },
    // a walking pedestrian from a static scan: it glides along its path with a small step bounce while 'walk' is on (front = +Z like the animated characters)
    walker(path, { h: hh = 1.7, fallbackIndex = 0 } = {}) {
      const g = new THREE.Group(); let walking = false, inner = null; g.userData = { play(n) { walking = n === 'walk'; }, anim: 'idle' };
      const fb = W.person(fallbackIndex, { anim: 'idle' }); g.add(fb); g.userData.play = n => { walking = n === 'walk'; fb.userData.play?.(n); };
      track(loadModel(path).then(gl => { const m = gl.scene.clone(true), b = new THREE.Box3().setFromObject(m), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), w = new THREE.Group();
        m.position.set(-c.x, -b.min.y, -c.z); w.add(m); w.scale.setScalar(hh / Math.max(0.001, sz.y)); shadows(w); inner = w; g.remove(fb); g.add(w); }).catch(() => {}));
      let t = 0; C.onFrame(dt => { if (!inner) return; t += dt * (walking ? 8 : 0); inner.position.y = walking ? Math.abs(Math.sin(t)) * 0.05 : 0; inner.rotation.z = walking ? Math.sin(t) * 0.03 : 0; });
      return g; },
    person(i = 0, { anim = 'idle', height = 1.75 } = {}) {
      const g = new THREE.Group(), key = typeof i === 'string' ? i : PEOPLE[i % PEOPLE.length]; g.userData = { play() {}, anim };
      const p = loadModel('people/' + key).then(gl => {
        const m = cloneSkinned(gl.scene); shadows(m); m.scale.setScalar(height / 0.67); g.add(m);     // Kenney characters are ~0.67 high
        const mx = new THREE.AnimationMixer(m); mixers.push(mx); let cur = null;
        g.userData.play = (name, fade = 0.2) => { const clip = THREE.AnimationClip.findByName(gl.animations, name); if (!clip) return; const a = mx.clipAction(clip); if (cur === a) return; a.reset().fadeIn(fade).play(); cur?.fadeOut(fade); cur = a; g.userData.anim = name; };
        g.userData.play(anim, 0);
      }).catch(() => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, height - 0.5, 4, 8), stdMat(0xe0a040)); b.position.y = height / 2; g.add(shadows(b)); });
      track(p); return g; },

    // ---------- city dressing
    prop(path, { scale = 8, x = 0, z = 0, ry = 0 } = {}) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      track(loadModel(path).then(gl => { const m = gl.scene.clone(true); m.scale.setScalar(scale); shadows(m); g.add(m); }).catch(() => {})); return g; },
    // buildings and trees on both sides of a straight road along Z (x of the road edge given), seeded
    street({ z0 = -120, z1 = 120, xLeft = -14, xRight = 14, seed = 3, density = 1 } = {}) {
      const r = rng(seed); const HOUSES = ['city/building-type-a', 'city/building-type-b', 'city/building-type-c', 'city/building-type-d', 'city/building-type-e', 'city/building-type-f', 'city/building-type-g', 'city/building-type-h'];
      const SHOPS = ['shops/building-a', 'shops/building-b', 'shops/building-c', 'shops/building-d', 'shops/building-e', 'shops/building-f', 'shops/building-g', 'shops/building-h', 'shops/building-skyscraper-a'];
      C.view.clampX = Math.min(Math.abs(xLeft), Math.abs(xRight)) + 3;
      for (const side of [-1, 1]) { let z = z0 + 6; while (z < z1 - 6) {
        const shop = r() < 0.55, path = (shop ? SHOPS : HOUSES)[Math.floor(r() * (shop ? SHOPS : HOUSES).length)], sc = shop ? 9 + r() * 2 : 8.5 + r() * 2, wdt = (shop ? 0.9 : 1.2) * sc * 0.95;
         W.prop(path, { scale: sc, x: (side < 0 ? xLeft - 9 - r() * 3 : xRight + 9 + r() * 3), z: z + wdt / 2, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2 }); z += wdt + 1.5 + r() * 3 / density; }
        for (let t = z0; t < z1; t += 11 + r() * 8) W.streetTree(r, { x: (side < 0 ? xLeft - 1.5 : xRight + 1.5), z: t }); }
    },
    trees(points, { scale = 9 } = {}) { const r = rng(9); for (const [x, z] of points) W.prop(r() < .5 ? 'city/tree-large' : 'city/tree-small', { scale: scale + r() * 2, x, z, ry: r() * 6 }); },

    // ---------- signs (drawn here, Israeli style; kinds: stop, yield, speed, crossing, nopass, noparking, nostop, rail, school, priority, give, custom)
    sign(kind, { x = 0, z = 0, ry = 0, n = 50, h: ph = 2.6, size = 0.9, text } = {}) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, ph + 0.4, 8), stdMat(0x8d949c, { metalness: .5, roughness: .4 })); pole.position.y = (ph + 0.4) / 2; g.add(pole);
      const tex = signTex(kind, n, text); const face = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: .5, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide }));
      face.position.set(0, ph, 0.06); g.add(face); const back = new THREE.Mesh(new THREE.CircleGeometry(size * 0.5, 24), stdMat(0xaab0b8)); back.position.set(0, ph, 0.04); back.rotation.y = Math.PI; g.add(back);
      shadows(g); scene.add(g); return g; },
    // traffic light on a pole facing +Z at ry=0; returns {g, set('red'|'yellow'|'green'|'off')}
    trafficLight({ x = 0, z = 0, ry = 0, state = 'red' } = {}) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 10), stdMat(0x4a4f57, { metalness: .4 })); pole.position.y = 2.1; g.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.2, 0.34), stdMat(0x1a1c20)); head.position.y = 4.4; g.add(head);
      const L = ['red', 'yellow', 'green'].map((c, i) => { const col = { red: 0xff2a1a, yellow: 0xffc000, green: 0x20e060 }[c]; const m = new THREE.MeshStandardMaterial({ color: 0x222, emissive: col, emissiveIntensity: 0, roughness: .3 }); const d = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), m); d.position.set(0, 4.75 - i * 0.35, 0.175); g.add(d); return [c, m, col]; });
      const set = s => { for (const [c, m, col] of L) { m.emissiveIntensity = c === s ? 2.2 : 0; m.color.setHex(c === s ? col : 0x222222); } };
      set(state); shadows(g); scene.add(g); return { g, set }; },
    cone(x, z) { return W.fit('prop2/cone_orange_01', { h: 0.75, x, z, fallback: 'cars/cone', fbScale: 1 }); },
    barrier(x, z, ry = 0) { return W.prop('roads/construction-barrier', { scale: 9, x, z, ry }); },
    // a coloured translucent zone on the road (used to show "no stopping here", gaps, etc.)
    zone(x, z, w, d, color, { opacity = 0.5, y = 0.06 } = {}) { return W.flat(x, z, w, d, color, { y, opacity, emissive: color }); },
    // distance marker: tall thin post with text
    post(x, z, text, { color = 0xffffff, size = 1.0, bg } = {}) { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), stdMat(color)); p.position.y = 0.7; g.add(p); if (text) { const l = label(text, { size, bg }); l.position.y = 2.1; g.add(l); } g.position.set(x, 0, z); scene.add(g); return g; },
  };
  return W;
}

// ---------------------------------------------------------------- Israeli-style sign faces (canvas); text is Hebrew, symbols are drawn here
function signTex(kind, n, text) {
  const key = 'sign:' + kind + ':' + n + ':' + (text || '');
  return canvasTex(key, 256, 256, (x, w) => {
    const R = '#c8102e', B = '#0a4da2', K = '#111'; x.clearRect(0, 0, w, w); x.lineJoin = 'round'; x.lineCap = 'round';
    const octa = (r, fill) => { x.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; x[i ? 'lineTo' : 'moveTo'](128 + r * Math.cos(a), 128 + r * Math.sin(a)); } x.closePath(); x.fillStyle = fill; x.fill(); };
    const tri = (up, r, fill, stroke, lw) => { x.beginPath(); const s = up ? -1 : 1; x.moveTo(128, 128 + s * r * 0.95); x.lineTo(128 - r * 0.95, 128 - s * r * 0.62); x.lineTo(128 + r * 0.95, 128 - s * r * 0.62); x.closePath(); x.fillStyle = fill; x.fill(); if (stroke) { x.lineWidth = lw; x.strokeStyle = stroke; x.stroke(); } };
    const circle = (r, fill, ring, lw) => { x.beginPath(); x.arc(128, 128, r, 0, 7); x.fillStyle = fill; x.fill(); if (ring) { x.lineWidth = lw; x.strokeStyle = ring; x.stroke(); } };
    const txt = (s, y, px, col = K) => { x.font = `700 ${px}px Rubik, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.direction = 'rtl'; x.fillText(s, 128, y); };
    const car = (cx, cy, s, col) => { x.fillStyle = col; x.fillRect(cx - 22 * s, cy - 8 * s, 44 * s, 14 * s); x.fillRect(cx - 12 * s, cy - 16 * s, 24 * s, 9 * s); x.fillStyle = K; x.beginPath(); x.arc(cx - 12 * s, cy + 7 * s, 5 * s, 0, 7); x.arc(cx + 12 * s, cy + 7 * s, 5 * s, 0, 7); x.fill(); };
    if (kind === 'stop') { octa(124, '#fff'); octa(114, R); txt('עצור', 112, 62, '#fff'); txt('STOP', 168, 34, '#fff'); }
    else if (kind === 'yield' || kind === 'give') { tri(false, 124, '#fff', R, 0); x.beginPath(); x.moveTo(128, 128 + 118); x.lineTo(128 - 118, 128 - 74); x.lineTo(128 + 118, 128 - 74); x.closePath(); x.lineWidth = 26; x.strokeStyle = R; x.stroke(); x.fillStyle = '#fff'; x.fill(); }
    else if (kind === 'speed') { circle(122, '#fff', R, 24); txt(String(n), 132, n >= 100 ? 92 : 108, K); }
    else if (kind === 'nopass') { circle(122, '#fff', R, 24); car(100, 140, 1.35, R); car(160, 140, 1.35, K); }
    else if (kind === 'noparking') { circle(122, B, R, 24); x.lineWidth = 22; x.strokeStyle = R; x.beginPath(); x.moveTo(60, 196); x.lineTo(196, 60); x.stroke(); }
    else if (kind === 'nostop') { circle(122, B, R, 24); x.lineWidth = 22; x.strokeStyle = R; x.beginPath(); x.moveTo(60, 196); x.lineTo(196, 60); x.moveTo(60, 60); x.lineTo(196, 196); x.stroke(); }
    else if (kind === 'crossing') { x.fillStyle = B; x.beginPath(); x.roundRect(10, 10, 236, 236, 18); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(128, 34); x.lineTo(32, 214); x.lineTo(224, 214); x.closePath(); x.fill();
      x.fillStyle = K; x.beginPath(); x.arc(128, 100, 12, 0, 7); x.fill(); x.lineWidth = 12; x.strokeStyle = K; x.beginPath(); x.moveTo(128, 112); x.lineTo(124, 156); x.lineTo(104, 190); x.moveTo(124, 156); x.lineTo(146, 188); x.moveTo(128, 120); x.lineTo(104, 144); x.moveTo(128, 120); x.lineTo(152, 140); x.stroke(); }
    else if (kind === 'warnPed') { tri(true, 124, '#fff', R, 30); x.fillStyle = K; for (let i = 0; i < 4; i++) x.fillRect(70 + i * 34, 168, 20, 30);
      x.beginPath(); x.arc(128, 100, 11, 0, 7); x.fill(); x.lineWidth = 11; x.strokeStyle = K; x.beginPath(); x.moveTo(128, 112); x.lineTo(124, 146); x.lineTo(106, 168); x.moveTo(124, 146); x.lineTo(144, 166); x.moveTo(128, 120); x.lineTo(108, 142); x.moveTo(128, 120); x.lineTo(148, 138); x.stroke(); }
    else if (kind === 'rail') { tri(true, 124, '#fff', R, 30); x.fillStyle = K; x.fillRect(86, 120, 84, 44); x.fillStyle = '#fff'; x.fillRect(96, 130, 22, 14); x.fillRect(128, 130, 22, 14); x.fillStyle = K; x.beginPath(); x.arc(104, 172, 7, 0, 7); x.arc(152, 172, 7, 0, 7); x.fill(); }
    else if (kind === 'school') { tri(true, 124, '#fff', R, 30); x.fillStyle = K; x.beginPath(); x.arc(108, 112, 10, 0, 7); x.arc(148, 120, 9, 0, 7); x.fill(); x.fillRect(100, 124, 16, 40); x.fillRect(141, 130, 14, 34); }
    else if (kind === 'priority') { x.save(); x.translate(128, 128); x.rotate(Math.PI / 4); x.fillStyle = '#fff'; x.fillRect(-92, -92, 184, 184); x.fillStyle = '#ffc800'; x.fillRect(-78, -78, 156, 156); x.restore(); }
    else if (kind === 'info') { x.fillStyle = B; x.beginPath(); x.roundRect(10, 10, 236, 236, 18); x.fill(); txt(text || '', 128, 56, '#fff'); }
    else { circle(122, '#fff', R, 24); txt(text || '', 128, 60, K); }
  });
}
