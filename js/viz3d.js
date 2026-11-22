// 3D versions of some lesson diagrams (three.js, bundled in vendor/, loaded only when a 3D view is opened).
// The facts in every caption are the same as in the 2D diagram next to it (viz.js); 3D only changes how they are shown.
// Distances in the "stopping distance" scene come from the official textbook figures; the split between reaction and braking is schematic.
import * as THREE from '../vendor/three.module.min.js';
import { h } from './ui.js';
import * as sfx from './sfx.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = x => x * x * (3 - 2 * x);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const shortest = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// ---------------------------------------------------------------- core: renderer, camera, orbit, loop, cleanup
function core(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 500);
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x56703a, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 1.15); sun.position.set(25, 45, 20); scene.add(sun);
  const view = { target: new THREE.Vector3(), yaw: 0.5, pitch: 0.6, dist: 40, goal: null, follow: null, driver: null };
  const updaters = [], cleaners = [];
  let dead = false, raf = 0, seen = false, wait = 0, last = performance.now(), visible = true;

  const put = () => { const c = Math.cos(view.pitch); camera.position.set(view.target.x + view.dist * Math.sin(view.yaw) * c, view.target.y + view.dist * Math.sin(view.pitch), view.target.z + view.dist * Math.cos(view.yaw) * c); camera.lookAt(view.target); };
  const apply = dt => {
    if (view.driver) { const g = view.driver, hd = g.rotation.y, fx = -Math.sin(hd), fz = -Math.cos(hd);   // driver's eyes, looking along the car's heading
      camera.position.set(g.position.x + fx * 0.2, 1.3, g.position.z + fz * 0.2); camera.lookAt(g.position.x + fx * 14, 1.1, g.position.z + fz * 14); return; }
    if (view.follow) { const k = 1 - Math.pow(0.001, dt); view.target.z += (view.follow.z() - view.target.z) * k; }
    if (view.goal) { const k = 1 - Math.pow(0.0005, dt), G = view.goal; view.yaw += shortest(view.yaw, G.yaw) * k; view.pitch += (G.pitch - view.pitch) * k; view.dist += (G.dist - view.dist) * k;
      if (G.target) view.target.lerp(G.target, k); if (Math.abs(shortest(view.yaw, G.yaw)) < 0.002 && Math.abs(G.dist - view.dist) < 0.05) view.goal = null; }
    put();
  };
  // orbit with the mouse / one finger; wheel zooms
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => { if (!drag || view.driver) return; view.goal = null; view.yaw -= (e.clientX - drag.x) * 0.008; view.pitch = clamp(view.pitch + (e.clientY - drag.y) * 0.006, 0.08, 1.5); drag = { x: e.clientX, y: e.clientY }; });
  const up = () => { drag = null; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { if (view.driver) return; e.preventDefault(); view.goal = null; view.dist = clamp(view.dist * (e.deltaY > 0 ? 1.08 : 0.92), 8, 160); }, { passive: false });
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; }) : null; io?.observe(canvas);

  function dispose() {
    if (dead) return; dead = true; cancelAnimationFrame(raf); io?.disconnect();
    for (const f of cleaners) { try { f(); } catch {} }
    scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.map?.dispose?.(); x.dispose?.(); }); });
    renderer.dispose(); try { renderer.forceContextLoss(); } catch {}
  }
  function frame(now) {
    if (dead) return;
    if (canvas.isConnected) seen = true; else if (seen || ++wait > 900) return dispose();
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (visible && canvas.clientWidth > 0) {
      const w = canvas.clientWidth, hh = canvas.clientHeight, pr = renderer.getPixelRatio();
      if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(hh * pr)) { renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix(); }
      for (const f of updaters) f(dt, now / 1000);
      apply(dt); renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { THREE, scene, camera, view, onFrame: f => updaters.push(f), onDispose: f => cleaners.push(f), dispose };
}

// the same page structure as the 2D diagrams (figure, stage, controls, text description)
function fig3(title, src, build) {
  const alt = h('p', { class: 'vz-alt', 'aria-live': 'polite' }), stage = h('div', { class: 'vz-stage vz3-stage' }), ctl = h('div', { class: 'vz-ctl' });
  const f = h('figure', { class: 'viz viz3', 'aria-label': title }, h('h3', { class: 'h3', text: title }), stage, ctl,
    h('figcaption', {}, h('span', { class: 'small muted', text: 'תיאור מילולי: ' }), alt, h('span', { class: 'small muted', text: src })));
  const canvas = document.createElement('canvas'); canvas.className = 'vz3-canvas'; canvas.setAttribute('aria-hidden', 'true');
  stage.append(canvas, h('p', { class: 'vz3-hint small muted', text: 'גרור עם העכבר כדי לסובב, גלגלת לזום' }));
  let C; try { C = core(canvas); } catch (e) { stage.replaceChildren(h('p', { class: 'warn-note', text: 'לא ניתן להציג תלת-ממד במחשב הזה. אפשר לחזור לתצוגה הדו-ממדית.' })); return f; }
  build({ C, ctl, say: s => { alt.textContent = s; } });
  return f;
}
const chip = (label, on, onclick) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), onclick, text: label });
const btn = (label, onclick, cls = 'btn small') => h('button', { type: 'button', class: cls, onclick, text: label });
function chipGroup(items, cur, on) {   // items: [[key,label]]
  const chips = items.map(([k, l]) => chip(l, k === cur, () => { chips.forEach((c, j) => c.setAttribute('aria-pressed', String(items[j][0] === k))); sfx.click(); on(k); }));
  return h('div', { class: 'row tight' }, chips);
}

// ---------------------------------------------------------------- building blocks
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
function flat(w, d, color, x, z, y = 0.02, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color, o)); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); return m; }
function box(w, hh, d, color, x, y, z, o = {}) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mat(color, o)); m.position.set(x, y, z); return m; }
function label(text, { size = 1.3, bg = 'rgba(18,28,48,.85)', fg = '#fff' } = {}) {
  const c = document.createElement('canvas'), x = c.getContext('2d'), fs = 64; x.font = `700 ${fs}px Rubik, Arial, sans-serif`;
  const w = Math.ceil(x.measureText(text).width) + 48; c.width = w; c.height = fs + 36;
  x.font = `700 ${fs}px Rubik, Arial, sans-serif`; x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = bg; x.beginPath(); x.roundRect?.(0, 0, c.width, c.height, 28); if (!x.roundRect) x.rect(0, 0, c.width, c.height); x.fill();
  x.fillStyle = fg; x.fillText(text, c.width / 2, c.height / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(size * c.width / c.height, size, 1); s.renderOrder = 10; return s;
}
function makeCar(color) {
  const g = new THREE.Group();
  g.add(box(1.8, 0.6, 4.2, color, 0, 0.65, 0, { roughness: 0.45, metalness: 0.25 }));
  g.add(box(1.6, 0.52, 2.2, 0x1d2733, 0, 1.2, 0.15, { roughness: 0.2, metalness: 0.5 }));
  for (const sx of [-1, 1]) for (const sz of [-1.3, 1.3]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 18), mat(0x111111)); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.9, 0.34, sz); g.add(w); }
  for (const sx of [-0.6, 0.6]) g.add(box(0.4, 0.18, 0.06, 0xfff2b0, sx, 0.75, -2.12, { emissive: 0xfff2b0, emissiveIntensity: 0.8 }));
  const brake = mat(0x661111, { emissive: 0xff0000, emissiveIntensity: 0.15 });
  for (const sx of [-0.65, 0.65]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.06), brake); b.position.set(sx, 0.75, 2.12); g.add(b); }
  const blinkM = mat(0x553300, { emissive: 0xffa000, emissiveIntensity: 0 });
  const bl = { L: [], R: [] };
  for (const [side, sx] of [['L', -0.85], ['R', 0.85]]) for (const sz of [-2.1, 2.1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.08), blinkM.clone()); b.position.set(sx, 0.75, sz); g.add(b); bl[side].push(b); }
  g.userData = { brake, bl, blinkSide: null };
  return g;
}
const setBrake = (car, on) => { car.userData.brake.emissiveIntensity = on ? 1.6 : 0.15; };
function blinkAnim(car, now) { const s = car.userData.blinkSide, on = s && Math.floor(now * 2.6) % 2 === 0; for (const side of ['L', 'R']) for (const b of car.userData.bl[side]) b.material.emissiveIntensity = on && side === s ? 1.8 : 0; }

// a path made of lines and quadratic curves, sampled by distance
class Path {
  constructor(segs) { this.segs = segs.map(s => ({ ...s, n: s.t === 'q' ? 24 : 1 })); this.pts = []; let acc = 0, prev = null;
    for (const s of this.segs) { const n = s.n; for (let i = (prev ? 1 : 0); i <= n; i++) { const u = i / n, p = s.t === 'q' ? this.q(s, u) : [s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u]; if (prev) acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]); this.pts.push({ p, s: acc }); prev = p; } }
    this.len = acc; }
  q(s, u) { const k = 1 - u; return [k * k * s.a[0] + 2 * k * u * s.c[0] + u * u * s.b[0], k * k * s.a[1] + 2 * k * u * s.c[1] + u * u * s.b[1]]; }
  at(d) { d = clamp(d, 0, this.len); const P = this.pts; let i = 1; while (i < P.length - 1 && P[i].s < d) i++; const a = P[i - 1], b = P[i], u = b.s > a.s ? (d - a.s) / (b.s - a.s) : 0;
    const x = a.p[0] + (b.p[0] - a.p[0]) * u, z = a.p[1] + (b.p[1] - a.p[1]) * u, dx = b.p[0] - a.p[0], dz = b.p[1] - a.p[1]; return { x, z, h: Math.atan2(-dx, -dz) }; }
}
function place(car, p) { car.position.set(p.x, 0, p.z); car.rotation.y = p.h; }

// ================================================================ SCENE 1: priority at a junction without signs (TR 64(א)(1), 64(א)(2))
function priority3d() {
  return fig3('מי עובר ראשון בצומת בלי תמרור?', 'לפי תקנה 64(א)(1) ו־64(א)(2)', ({ C, ctl, say }) => {
    const { scene, view } = C;
    scene.add(flat(140, 140, 0x6f9c52, 0, 0, 0, { roughness: 1 }), flat(7, 90, 0x3b3f47, 0, 0), flat(90, 7, 0x3b3f47, 0, 0));
    for (const [x, z, hgt] of [[-9.5, -9.5, 3.2], [9.5, -9.5, 4.2], [-9.5, 9.5, 3.6], [9.5, 9.5, 2.8]]) scene.add(box(8, hgt, 8, 0xd8cdb8, x, hgt / 2, z));
    for (let k = 0; k < 9; k++) { const o = 5 + k * 5; for (const s of [-1, 1]) { scene.add(flat(0.18, 2.4, 0xeeeeee, 0, s * (o + 4), 0.03), flat(2.4, 0.18, 0xeeeeee, s * (o + 4), 0, 0.03)); } }
    for (const [x, z, w, d] of [[1.8, 3.9, 3.2, 0.3], [-1.8, -3.9, 3.2, 0.3], [3.9, -1.8, 0.3, 3.2], [-3.9, 1.8, 0.3, 3.2]]) scene.add(flat(w, d, 0xffffff, x, z, 0.03));
    const me = makeCar(0x2a6fdb), other = makeCar(0xe8693a); scene.add(me, other);
    const lab = label('אתה', { size: 1.4, bg: 'rgba(42,111,219,.95)' }); lab.position.set(0, 3.4, 0); me.add(lab);
    const SC = {
      right: { label: 'רכב מגיע מימין', intro: 'אתה נוסע צפונה. רכב אחר מגיע מימינך. אין תמרור ואין רמזור.',
        me: new Path([{ t: 'l', a: [1.8, 24], b: [1.8, -24] }]), other: new Path([{ t: 'l', a: [24, -1.8], b: [-24, -1.8] }]), blink: null,
        steps: [[15.2, 15.2, 'שני הרכבים ממתינים בכניסה לצומת.'], [15.2, 48, 'הרכב שבא מימינך עובר ראשון.'], [48, 48, 'עכשיו הצומת פנוי ואתה ממשיך.']] },
      left: { label: 'אתה פונה שמאלה', intro: 'אתה רוצה לפנות שמאלה. רכב מגיע ממול וממשיך ישר.',
        me: new Path([{ t: 'l', a: [1.8, 24], b: [1.8, 2.2] }, { t: 'q', a: [1.8, 2.2], c: [1.8, -1.8], b: [-2.2, -1.8] }, { t: 'l', a: [-2.2, -1.8], b: [-24, -1.8] }]), other: new Path([{ t: 'l', a: [-1.8, -24], b: [-1.8, 24] }]), blink: 'L',
        steps: [[17.2, 12, 'אתה בכניסה לצומת עם איתות שמאלה; הרכב ממול מתקרב.'], [17.2, 48, 'הרכב שממול עובר ראשון – מי שפונה שמאלה ממתין לו.'], [24.2, 48, 'הדרך פנויה ואתה מתחיל לפנות.'], [null, 48, 'סיימת את הפנייה שמאלה.']] },
    };
    let sc = 'right', i = 0, run = null, eng = null, quiet = 0;
    const S = () => SC[sc];
    const pose = { me: 0, other: 0 };
    const goto = (a, b, instant) => { run = { a0: pose.me, b0: pose.other, a1: a, b1: b, t: instant || reduced() ? 1 : 0, dur: 2.4 }; };
    const stepTargets = () => { const s = S().steps[i]; return [s[0] === null ? S().me.len : s[0], s[1]]; };
    const show = (first) => {
      const s = S().steps[i];
      if (first) { pose.me = 0; pose.other = 0; place(me, S().me.at(0)); place(other, S().other.at(0)); }
      const [a, b] = stepTargets(); goto(a, b, false);
      me.userData.blinkSide = S().blink && i <= 2 ? S().blink : null; setBlinker();
      say(`${S().intro} צעד ${i + 1} מתוך ${S().steps.length}: ${s[2]}`); nextB.disabled = i >= S().steps.length - 1; if (nextB.disabled && document.activeElement === nextB) againB.focus();
    };
    let bl = null; const setBlinker = () => { if (me.userData.blinkSide && !bl) bl = sfx.blinker(); else if (!me.userData.blinkSide && bl) { bl.stop(); bl = null; } };
    C.onDispose(() => { bl?.stop(); eng?.stop(); });
    C.onFrame((dt, now) => {
      blinkAnim(me, now);
      if (run) { run.t = Math.min(1, run.t + dt / run.dur); const k = ease(run.t); pose.me = run.a0 + (run.a1 - run.a0) * k; pose.other = run.b0 + (run.b1 - run.b0) * k;
        place(me, S().me.at(pose.me)); place(other, S().other.at(pose.other));
        const v = Math.max(Math.abs(run.a1 - run.a0), Math.abs(run.b1 - run.b0)) / run.dur * Math.sin(run.t * Math.PI) * 0.5;
        if (run.t < 1) { quiet = 0; if (!eng) eng = sfx.engine(); eng.set(Math.min(1, v / 14)); } else run = null; }
      else if (eng && (quiet += dt) > 0.4) { eng.stop(); eng = null; }
    });
    const cams = { top: { yaw: 0, pitch: 1.45, dist: 46 }, three: { yaw: 0.55, pitch: 0.6, dist: 40 }, side: { yaw: -1.0, pitch: 0.32, dist: 30 } };
    const camSel = chipGroup([['three', 'מבט חצי'], ['top', 'מלמעלה'], ['side', 'מהצד'], ['drv', 'מבט הנהג']], 'three', k => {
      if (k === 'drv') { view.driver = me; view.goal = null; } else { view.driver = null; view.goal = { ...cams[k], target: new THREE.Vector3(0, 0, 0) }; } });
    Object.assign(view, { yaw: 0.55, pitch: 0.6, dist: 40 }); view.target.set(0, 0, 0);
    const scs = chipGroup(Object.keys(SC).map(k => [k, SC[k].label]), sc, k => { sc = k; i = 0; show(true); });
    const nextB = btn('הצעד הבא', () => { sfx.click(); i++; show(); }, 'btn small primary'), againB = btn('מההתחלה', () => { sfx.click(); i = 0; show(true); });
    ctl.append(scs, h('div', { class: 'row tight' }, nextB, againB), camSel);
    show(true);
  });
}

// ================================================================ SCENE 2: stopping distance (textbook pp. 22–23: ~24 m at 50 km/h, ~77 m at 100 km/h)
function stopdist3d() {
  return fig3('מרחק העצירה', 'לפי ספר הלימוד הרשמי "נוהגים אחרת – נוהגים נכון" (הרשות הלאומית לבטיחות בדרכים ומשרד התחבורה), עמ׳ 22–23', ({ C, ctl, say }) => {
    const { scene, view } = C, P0 = 0, LANE = 1.8, TOT = { 50: 24, 100: 77 };
    scene.add(flat(160, 330, 0x6f9c52, 0, -100, 0, { roughness: 1 }), flat(9, 330, 0x3b3f47, 0, -100), flat(0.18, 330, 0xffffff, -4.3, -100, 0.03), flat(0.18, 330, 0xffffff, 4.3, -100, 0.03));
    for (let z = 60; z > -250; z -= 6) scene.add(flat(0.16, 2.6, 0xeeeeee, 0, z, 0.03));
    for (let m = 10; m <= 100; m += 10) { scene.add(box(0.15, 1.2, 0.15, 0xffffff, 5.2, 0.6, P0 - m)); if (m % 20 === 0) { const l = label(m + ' מ׳', { size: 0.9 }); l.position.set(6.4, 1.8, P0 - m); scene.add(l); } }
    for (const [v, col] of [[50, 0xf5b301], [100, 0xe5483f]]) { const d = TOT[v]; scene.add(flat(9, 0.5, col, 0, P0 - d, 0.05));
      for (const s of [-1, 1]) scene.add(box(0.2, 3.2, 0.2, col, s * 5.3, 1.6, P0 - d)); scene.add(box(10.8, 0.25, 0.25, col, 0, 3.2, P0 - d));
      const l = label(`${v} קמ"ש: כ־${d} מ׳`, { size: 1.15, bg: v === 50 ? 'rgba(160,110,0,.92)' : 'rgba(170,40,35,.92)' }); l.position.set(0, 4.6, P0 - d); scene.add(l); }
    const car = makeCar(0x2a6fdb); car.position.set(LANE, 0, P0 + 40); scene.add(car);
    const hazard = box(1.2, 1.2, 1.2, 0xcc2f2f, LANE, 0.6, 0, { emissive: 0x551111, emissiveIntensity: 0.5 }); hazard.visible = false; scene.add(hazard);
    const warn = label('סכנה!', { size: 1.4, bg: 'rgba(200,30,30,.95)' }); warn.position.set(LANE, 3.4, P0); warn.visible = false; scene.add(warn);
    const zones = new THREE.Group(); scene.add(zones);
    let speed = 50, slow = false, st = null, eng = null;
    const kmh = v => v / 3.6;
    const info = 'ב־50 קמ"ש מרחק העצירה כ־24 מטר; ב־100 קמ"ש כ־77 מטר. מהירות כפולה – מרחק עצירה בערך משולש. מרחק העצירה הוא מרחק התגובה (מה שהרכב עובר עד שהנהג מגיב) ועוד מרחק הבלימה. החלוקה בין השניים בציור היא להמחשה בלבד; המספרים הרשמיים הם המרחק הכולל.';
    const reset = () => { st = null; zones.clear(); hazard.visible = false; warn.visible = false; setBrake(car, false); car.position.set(LANE, 0, P0 + 40); eng?.stop(); eng = null; };
    const start = () => {
      reset(); const v = kmh(speed), D = TOT[speed], dr = v * 1.0, db = D - dr, a = v * v / (2 * db);
      const z1 = flat(9, dr, 0xf5b301, 0, P0 - dr / 2, 0.04, { transparent: true, opacity: 0.55 }), z2 = flat(9, db, 0xe5483f, 0, P0 - dr - db / 2, 0.04, { transparent: true, opacity: 0.55 });
      zones.add(z1, z2); hazard.position.z = P0 - D - 0.8; hazard.visible = true;
      st = { v, D, dr, a, t: 0, front: P0 + 40 + 2.1, phase: 'cruise', cur: v, done: false, dt: 0 };
      if (!eng) eng = sfx.engine();
      say(`${speed} קמ"ש. הנהג מבחין בסכנה בנקודה המסומנת, ורק אחרי זמן תגובה הוא מתחיל לבלום. מרחק העצירה: כ־${D} מטר. ${info}`);
    };
    const speedSel = chipGroup([[50, '50 קמ"ש'], [100, '100 קמ"ש']], 50, k => { speed = +k; reset(); say(info); });
    const goB = btn('הפעל', () => { sfx.click(); start(); }, 'btn small primary'), slowB = chip('הילוך איטי', false, () => { slow = !slow; slowB.setAttribute('aria-pressed', String(slow)); });
    const follow = { z: () => (st ? Math.min(P0 + 12, car.position.z) - 10 : P0 - 8) };
    const cams = { side: { yaw: 1.25, pitch: 0.32, dist: 30 }, back: { yaw: 0.2, pitch: 0.28, dist: 16 }, top: { yaw: 0, pitch: 1.45, dist: 70 } };
    view.follow = follow; Object.assign(view, { yaw: 1.25, pitch: 0.32, dist: 30 }); view.target.set(LANE, 1, P0 - 8);
    const camSel = chipGroup([['side', 'מבט צד'], ['back', 'מאחורי הרכב'], ['top', 'מלמעלה']], 'side', k => { view.follow = follow; view.goal = { ...cams[k], target: null }; });
    C.onDispose(() => eng?.stop());
    C.onFrame(dt => {
      if (!st || st.done) return; const d = dt * (slow ? 0.3 : 1); st.t += d;
      if (st.phase === 'cruise' && st.front <= P0) { st.phase = 'react'; warn.visible = true; sfx.beep(); }
      if (st.phase === 'react' && st.front <= P0 - st.dr) { st.phase = 'brake'; setBrake(car, true); sfx.brake(); }
      if (st.phase === 'brake') st.cur = Math.max(0, st.cur - st.a * d);
      st.front -= st.cur * d; car.position.z = st.front - 2.1; eng?.set(st.cur / 30);
      if (st.phase === 'brake' && st.cur <= 0.01) { st.done = true; eng?.stop(); eng = null; setTimeout(() => { warn.visible = false; setBrake(car, false); }, 900); }
    });
    ctl.append(speedSel, h('div', { class: 'row tight' }, goB, slowB), camSel);
    say(info);
  });
}

// ================================================================ SCENE 3: parts of the road (TO 1 "דרך"; TR 1 "כביש", "נתיב", "שטח הפרדה", "שול הדרך")
function roadparts3d() {
  const RP = [['road', 'דרך', 'דרך – כל השטח הפתוח שיש לציבור זכות לעבור בו: הכבישים, שטח ההפרדה והשוליים (פקודת התעבורה 1).'],
    ['cw', 'כביש', 'כביש – החלק שמיועד לתנועת כלי רכב, בלי השוליים. כאן יש שני כבישים, אחד מכל צד של שטח ההפרדה (תקנה 1).'],
    ['lane', 'נתיב', 'נתיב – חלק מרוחב הכביש שמספיק לטור אחד של כלי רכב, מסומן או לא. כל כביש כאן מחולק לשני נתיבים (תקנה 1).'],
    ['sep', 'שטח הפרדה', 'שטח הפרדה – אי תנועה, גינה, סימון או שטח לא סלול שמחלקים את הדרך לאורכה (תקנה 1).'],
    ['sh', 'שול', 'שול הדרך – השטח שליד שפת הכביש כשאין לידו מדרכה, עד רוחב של 4 מטרים (תקנה 1).']];
  return fig3('חלקי הדרך – לחצו על חלק', 'לפי פקודת התעבורה 1 ותקנה 1', ({ C, ctl, say }) => {
    const { scene, view } = C, SH = 3, CW = 7.4, SEP = 3, L = 140;
    const cwR = SEP / 2 + CW / 2, cwL = -cwR, shR = SEP / 2 + CW + SH / 2, shL = -shR;
    scene.add(flat(160, L, 0x6f9c52, 0, 0, 0, { roughness: 1 }), flat(SH, L, 0xb9ab8a, shR, 0, 0.02), flat(SH, L, 0xb9ab8a, shL, 0, 0.02), flat(CW, L, 0x3b3f47, cwR, 0), flat(CW, L, 0x3b3f47, cwL, 0),
      flat(SEP, L, 0x5f9b4a, 0, 0, 0.06), box(0.25, 0.14, L, 0xcfcfcf, SEP / 2, 0.07, 0), box(0.25, 0.14, L, 0xcfcfcf, -SEP / 2, 0.07, 0));
    for (const cx of [cwR, cwL]) { scene.add(flat(0.14, L, 0xffffff, cx - CW / 2 + 0.2, 0, 0.03), flat(0.14, L, 0xffffff, cx + CW / 2 - 0.2, 0, 0.03)); for (let z = -L / 2; z < L / 2; z += 6) scene.add(flat(0.14, 2.6, 0xffffff, cx, z + 1.3, 0.03)); }
    const cars = [];
    [[cwR + CW / 4, 0x2a6fdb, -1, 0], [cwR - CW / 4, 0xe8693a, -1, 40], [cwL - CW / 4, 0x2e9d57, 1, 20], [cwL + CW / 4, 0xd0b21c, 1, 70]].forEach(([x, col, dir, off]) => { const c = makeCar(col); c.userData.dir = dir; c.userData.off = off; c.position.x = x; c.rotation.y = dir < 0 ? 0 : Math.PI; scene.add(c); cars.push(c); });
    C.onFrame((dt, now) => { for (const c of cars) { const z = (now * 9 + c.userData.off) % L; c.position.z = c.userData.dir < 0 ? L / 2 - z : -L / 2 + z; } });   // drive on the right: northbound cars on the east side
    // highlight overlays
    const hl = new THREE.Group(); scene.add(hl); let tint = [], lab = null;
    const ov = (w, x, color = 0x2a8cff, o = 0.5) => { const m = flat(w, L, color, x, 0, 0.1, { transparent: true, opacity: o, emissive: color, emissiveIntensity: 0.5, depthWrite: false }); tint.push(m); hl.add(m); return m; };
    const lanesX = [cwL - CW / 4, cwL + CW / 4, cwR - CW / 4, cwR + CW / 4];
    const PARTS = { road: () => [ov(SH * 2 + CW * 2 + SEP, 0)], cw: () => [ov(CW, cwR), ov(CW, cwL)], lane: () => lanesX.map((x, i) => ov(CW / 2 - 0.15, x, [0x2a8cff, 0xf5b301][i % 2])), sep: () => [ov(SEP, 0, 0x2ecc71)], sh: () => [ov(SH, shR, 0xe5483f), ov(SH, shL, 0xe5483f)] };
    const LABX = { road: 0, cw: cwR, lane: lanesX[2], sep: 0, sh: shR };
    const run = k => { hl.clear(); tint = []; lab && scene.remove(lab); PARTS[k](); const p = RP.find(r => r[0] === k); lab = label(p[1], { size: 1.7 }); lab.position.set(LABX[k], 3.6, 8); scene.add(lab); say(p[2]); };
    C.onFrame((dt, now) => { const o = 0.38 + 0.22 * Math.sin(now * 3); for (const m of tint) m.material.opacity = o; });
    const cams = { three: { yaw: 0.55, pitch: 0.5, dist: 40 }, top: { yaw: 0, pitch: 1.45, dist: 44 }, eye: { yaw: 0, pitch: 0.16, dist: 30 } };
    Object.assign(view, cams.three); view.target.set(0, 0, 0);
    const sel = chipGroup(RP.map(p => [p[0], p[1]]), 'road', run), camSel = chipGroup([['three', 'מבט חצי'], ['top', 'מלמעלה'], ['eye', 'מהכביש']], 'three', k => { view.goal = { ...cams[k], target: new THREE.Vector3(0, 0, 0) }; });
    ctl.append(sel, camSel); run('road');
  });
}

export const SCENES = { priority: priority3d, stopdist: stopdist3d, roadparts: roadparts3d };
