// "Signs on the road" (תמרורים בכביש): a sign standing on a real 3D road, an orange arrow from the sign to the reason it is there, the car doing what the sign asks,
// then one short question. Watch first, then the quiz. Entry: #/signs/world (button in the signs trainer).
// Table-driven: adding a sign = one entry in SIGNS (official number, sign texture kind, builder, camera, events). Meaning texts come from data/signs.json
// (the official sign table, gov.il PDF): the quiz answers are the table's own wording, the wrong answers are other entries' official meanings.
// Every scene is a pure function of its clock t (seconds), so stepping, replay, reduced motion and scrubbing share one code path.
import { THREE, fig3, chipGroup, btn, label, sfx, reduced, LANE, LANE_W } from '../kit3d.js';
import { h } from '../ui.js';
import { junction } from './_junction.js';

// ---------------------------------------------------------------- small helpers
export const lerp = (a, b, u) => a + (b - a) * u;
const smooth = u => u * u * (3 - 2 * u);
export const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));      // 0 before a, 1 after b
// speed profile (m/s, piecewise linear) -> a function t -> z for a car driving north (-Z); the car is at zAlign at time tAlign
export function run(vKeys, tAlign, zAlign) {
  const dt = 0.02, T = vKeys[vKeys.length - 1][0], n = Math.ceil(T / dt) + 1, s = new Float32Array(n), v = t => { for (let i = 1; i < vKeys.length; i++) if (t <= vKeys[i][0]) { const [t0, v0] = vKeys[i - 1], [t1, v1] = vKeys[i]; return lerp(v0, v1, (t - t0) / (t1 - t0)); } return vKeys[vKeys.length - 1][1]; };
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + v((i - 0.5) * dt) * dt;
  const at = t => { const f = Math.min(n - 1, Math.max(0, t / dt)), i = Math.floor(f), u = f - i; return lerp(s[i], s[Math.min(n - 1, i + 1)], u); };
  const sA = at(tAlign);
  return { z: t => zAlign - (at(t) - sA), v };
}
const straight = (C, W) => { W.roadZ({ z0: -120, z1: 120, centre: 'dash' }); W.street({ z0: -110, z1: 110, xLeft: -9.2, xRight: 9.2, seed: 5 }); };
const stripedArm = (W, THREE_, len = 4.3) => {            // a barrier arm lying along -x from its pivot (red and white segments)
  const g = new THREE.Group(), n = 8;
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(len / n, 0.14, 0.1), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf2f2f2 : 0xd62828, roughness: 0.5 })); m.position.x = -(i + 0.5) * len / n; m.castShadow = true; g.add(m); }
  return g;
};

// ---------------------------------------------------------------- the five scenes
// each builder returns { duration, events:[[t,text]], sign:Vector3 (sign head), target:Vector3 (the reason), cam, update(t) }
export const SIGNS = [
  { id: 'rail', n: '133', kind: 'rail', chip: 'מסילת ברזל', arrow: 'מפגש מסילת ברזל', build(x) {
    const { C, W, scene, car } = x, ZR = -14; straight(C, W);
    for (const s of [-0.72, 0.72]) W.box(0, 0.16, ZR + s, 240, 0.12, 0.1, 0x8a8f96, { metalness: 0.7, roughness: 0.35 });          // rails along X
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.1, 2.6), new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 }), 220), M = new THREE.Matrix4(); let k = 0;
    for (let xx = -75; xx <= 75; xx += 0.7) { if (Math.abs(xx) < 4.4) continue; M.setPosition(xx, 0.06, ZR); sl.setMatrixAt(k++, M); } sl.count = k; sl.receiveShadow = true; scene.add(sl);
    W.sign('rail', { x: 5.4, z: 17, ry: 0, size: 1.8 }); W.stopLine(LANE, -7.6, LANE_W - 0.6);
    const arms = [], lampM = [0, 1].map(() => new THREE.MeshStandardMaterial({ color: 0x400, emissive: 0xff1a1a, emissiveIntensity: 0, roughness: 0.3 }));
    const post = (px, pz, dir) => { const g = new THREE.Group(); g.position.set(px, 0, pz); scene.add(g);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x2f343b })); p.position.y = 0.65; p.castShadow = true; g.add(p);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), new THREE.MeshStandardMaterial({ color: 0xe8e8e8 })); mast.position.y = 1.5; g.add(mast);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x1a1c20 })); head.position.set(0, 3.1, 0); g.add(head);
      lampM.forEach((m, i) => { for (const zz of [0.11, -0.11]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), m); l.position.set((i ? 1 : -1) * 0.22, 3.1, zz); if (zz < 0) l.rotation.y = Math.PI; g.add(l); } });
      const pivot = new THREE.Group(); pivot.position.set(0, 1.2, 0); const arm = stripedArm(W); if (dir > 0) arm.scale.x = -1; pivot.add(arm); g.add(pivot); arms.push({ pivot, dir }); };
    post(4.7, ZR + 3.2, -1); post(-4.7, ZR - 3.2, 1);
    const loco = W.vehicle('loco'), wag = W.vehicle('train'), train = new THREE.Group(); loco.position.z = 0; wag.position.z = 14.6; train.add(loco, wag); train.rotation.y = -Math.PI / 2; train.position.set(-90, 0, ZR); scene.add(train);
    const R = run([[0, 12], [3, 12], [6.4, 0], [13.5, 0], [16.5, 12], [24, 12]], 6.4, -5.1);
    return { duration: 22, hold: 9, sign: new THREE.Vector3(5.4, 3.0, 17), target: new THREE.Vector3(0, 1.3, ZR), cam: { yaw: 0.9, pitch: 0.42, dist: 52, target: new THREE.Vector3(0, 0, 4) },
      events: [[0, 'התמרור מזהיר: מקום מפגש מסילת ברזל. הרכב מתקרב.'], [3.2, 'האורות מהבהבים והמחסומים יורדים: הרכב מאט ועוצר לפניהם.'], [6.6, 'רכבת חוצה את הכביש.'], [13.4, 'הרכבת עברה, המחסומים עולים והרכב ממשיך.']],
      update(t) { car.position.set(LANE, 0, R.z(t)); const down = Math.min(seg(t, 3.4, 5), 1 - seg(t, 12.6, 14.2));
        for (const a of arms) a.pivot.rotation.z = a.dir * 1.4 * (1 - down); const on = t > 3.2 && t < 14.2 && Math.floor(t * 2.6) % 2 === 0; lampM[0].emissiveIntensity = on ? 2.4 : 0; lampM[1].emissiveIntensity = on ? 0 : (t > 3.2 && t < 14.2 ? 2.4 : 0);
        train.position.x = lerp(-90, 90, seg(t, 5.8, 12.6)); W.setBrake(car, R.v(t) < R.v(Math.max(0, t - 0.15)) - 0.2 && R.v(t) > -1 && t < 7); } }; } },

  { id: 'crossing', n: '135', kind: 'warnPed', chip: 'מעבר חצייה', arrow: 'מעבר חצייה להולכי רגל', build(x) {
    const { C, W, car } = x, ZC = -12; straight(C, W); W.zebra(0, ZC, LANE_W * 2 - 0.8, { depth: 3.2 }); W.stopLine(LANE, ZC + 4.2, LANE_W - 0.6); W.stopLine(-LANE, ZC - 4.2, LANE_W - 0.6);
    W.sign('warnPed', { x: 5.4, z: 20, ry: 0, size: 1.8 });
    const ped = W.person(0, { anim: 'idle', height: 1.72 }); x.scene.add(ped);
    const R = run([[0, 12], [2.8, 12], [7, 0], [10.4, 0], [13.6, 12], [20, 12]], 7, -4.4);
    return { duration: 18, hold: 8.5, sign: new THREE.Vector3(5.4, 3.0, 20), target: new THREE.Vector3(0, 1.4, ZC), cam: { yaw: 0.85, pitch: 0.4, dist: 46, target: new THREE.Vector3(0, 0, 4) },
      events: [[0, 'התמרור מזהיר: מעבר חצייה להולכי רגל בקרבת מקום. הרכב מתקרב.'], [4.5, 'הולכת רגל מתחילה לחצות במעבר החצייה.'], [7, 'הרכב עוצר לפני מעבר החצייה.'], [10.4, 'ההולכת סיימה לחצות את נתיב הרכב והרכב ממשיך.']],
      update(t) { car.position.set(LANE, 0, R.z(t)); const u = seg(t, 4.5, 14.5); ped.position.set(lerp(8.5, -8.5, u), 0, ZC); ped.rotation.y = -Math.PI / 2; ped.userData.play(u > 0 && u < 1 ? 'walk' : 'idle'); W.setBrake(car, R.v(t) < R.v(Math.max(0, t - 0.15)) - 0.2 && t < 8); } }; } },

  { id: 'peds', n: '136', kind: 'school', chip: 'הולכי רגל', arrow: 'הולכי רגל בקרבת מקום', build(x) {
    const { C, W, car, scene } = x, ZP = -8; straight(C, W); W.sign('school', { x: 5.4, z: 20, ry: 0, size: 1.8 });
    const kids = [3, 4, 5].map((i, j) => { const k = W.person(i, { anim: 'idle', height: 1.25 }); scene.add(k); return { k, t0: [4, 6, 9][j], sp: [1.3, 1.9, 1.3][j], x0: 6.6 + j * 0.8 }; });
    const R = run([[0, 12], [3, 12], [7.5, 0], [14.5, 0], [18, 10], [21, 12]], 7.5, -1.6);
    return { duration: 20, hold: 9.5, sign: new THREE.Vector3(5.4, 3.0, 20), target: new THREE.Vector3(0, 1.6, ZP), cam: { yaw: 0.85, pitch: 0.4, dist: 46, target: new THREE.Vector3(0, 0, 6) },
      events: [[0, 'התמרור מזהיר: הולכי רגל בקרבת מקום. ילדים על המדרכה.'], [4, 'ילד מתחיל לחצות את הכביש.'], [7.5, 'הרכב האט ועצר לפני הילדים החוצים.'], [14.5, 'הילדים עברו והרכב ממשיך בזהירות.']],
      update(t) { car.position.set(LANE, 0, R.z(t)); for (const o of kids) { const d = Math.max(0, (t - o.t0) * o.sp), xx = Math.max(-7, o.x0 - d), moving = t > o.t0 && xx > -7; o.k.position.set(xx, 0, ZP + (kids.indexOf(o) - 1) * 0.9); o.k.rotation.y = -Math.PI / 2; o.k.userData.play(moving ? 'walk' : 'idle'); }
        W.setBrake(car, R.v(t) < R.v(Math.max(0, t - 0.15)) - 0.2 && t < 9); } }; } },

  { id: 'stop', n: '302', kind: 'stop', chip: 'עצור', arrow: 'תנועה בדרך החוצה', build(x) {
    const { C, W, car } = x, J = junction(C, W, { v: { one: false, n: 1 }, hz: { one: false, n: 1 }, L: 90, P: 4, houses: true });
    W.sign('stop', { x: 5.6, z: 6.2, ry: 0, size: 1.7 }); W.stopLine(LANE, J.hh + 0.9, LANE_W - 0.6);
    const cross = W.vehicle('hatch'); x.scene.add(cross); cross.rotation.y = Math.PI / 2;                           // drives west along the northern lane
    const R = run([[0, 12], [2.6, 12], [5.6, 0], [8.8, 0], [11.8, 12], [20, 12]], 5.6, J.hh + 1.2 + 2.35);
    return { duration: 17, hold: 7, sign: new THREE.Vector3(5.6, 3.0, 6.2), target: new THREE.Vector3(0, 1.0, -J.hh * 0.5), cam: { yaw: 0.8, pitch: 0.5, dist: 40, target: new THREE.Vector3(0, 0, 0) },
      events: [[0, 'התמרור 302: עצור. הרכב מתקרב לקו העצירה.'], [3, 'מתקרבת תנועה בדרך החוצה.'], [5.6, 'הרכב עצר לגמרי לפני הצומת.'], [8.8, 'התנועה בדרך החוצה עברה והרכב ממשיך.']],
      update(t) { car.position.set(LANE, 0, R.z(t)); cross.position.set(lerp(70, -70, seg(t, 2.2, 9)), 0, -LANE_W / 2); W.setBrake(car, R.v(t) < R.v(Math.max(0, t - 0.15)) - 0.2 && t < 7); } }; } },

  { id: 'yield', n: '301', kind: 'yield', chip: 'תן זכות קדימה', arrow: 'תנועה בדרך החוצה', build(x) {
    const { C, W, car } = x, J = junction(C, W, { v: { one: false, n: 1 }, hz: { one: false, n: 1 }, L: 90, P: 4, houses: true });
    W.sign('yield', { x: 5.6, z: 6.2, ry: 0, size: 1.7 }); W.teeth(LANE, J.hh + 0.9, LANE_W - 0.6, { dir: 1 });
    const cross = W.vehicle('hatch'); x.scene.add(cross); cross.rotation.y = Math.PI / 2;
    const R = run([[0, 12], [3, 12], [5.4, 2.6], [7.4, 2.6], [10.4, 12], [20, 12]], 5.8, J.hh + 1.2 + 2.35);
    return { duration: 16, hold: 5.6, sign: new THREE.Vector3(5.6, 3.0, 6.2), target: new THREE.Vector3(0, 1.0, -J.hh * 0.5), cam: { yaw: 0.8, pitch: 0.5, dist: 40, target: new THREE.Vector3(0, 0, 0) },
      events: [[0, 'התמרור 301: תן זכות קדימה. הרכב מתקרב.'], [3, 'הרכב מאט; מתקרבת תנועה בדרך החוצה.'], [5.5, 'הרכב נותן זכות קדימה לתנועה החוצה.'], [7.4, 'הדרך פנויה והרכב ממשיך.']],
      update(t) { car.position.set(LANE, 0, R.z(t)); cross.position.set(lerp(70, -70, seg(t, 2.6, 8.6)), 0, -LANE_W / 2); W.setBrake(car, R.v(t) < R.v(Math.max(0, t - 0.15)) - 0.2 && t < 6.5); } }; } },
];

// ---------------------------------------------------------------- orange pulsing arrow from the sign to its reason
export function makeArrow(p0, p1, text) {
  const g = new THREE.Group(), mid = p0.clone().lerp(p1, 0.5); mid.y += 4.2;
  const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1), M = new THREE.MeshBasicMaterial({ color: 0xff8a00, transparent: true, opacity: 0.95, depthTest: false });
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.13, 8, false), M); tube.renderOrder = 8;
  const dir = curve.getTangent(1).normalize(), head = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 16), M); head.position.copy(p1).addScaledVector(dir, -0.4); head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); head.renderOrder = 8;
  const lab = label(text, { size: 1.5, bg: 'rgba(214,100,0,.96)' }); lab.position.copy(mid).add(new THREE.Vector3(0, 1.2, 0));
  g.add(tube, head, lab); g.userData.pulse = now => { const k = reduced() ? 1 : 0.72 + 0.28 * Math.sin(now * 5.5); M.opacity = k; head.scale.setScalar(reduced() ? 1 : 1 + 0.16 * Math.sin(now * 5.5)); };
  return g;
}

// ---------------------------------------------------------------- the figure
export default function signs3d() {
  return fig3('תמרורים בכביש', 'לפי לוח התמרורים הרשמי (gov.il); התנועה בסצנות להמחשה', async ({ C, W, ctl, say }) => {
    const { scene, view } = C, SG = await fetch(new URL('../../data/signs.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('signs'); return r.json(); });
    const full = n => SG.e[n], short = n => SG.e[n].split(' · ')[0].trim();
    W.env({ ground: 'grass', size: 200, shadowSize: 50 });
    let cur = null, made = [], script = null, car = null, arrow = null, t = 0, playing = false, evIdx = -1, done = new Set(), quiz = null;
    const cap = f => { const n = scene.children.length; f(); return scene.children.slice(n); };
    const drop = arr => arr.forEach(o => { scene.remove(o); o.traverse(m => { if (m.userData?.shared) return; m.geometry?.dispose?.(); for (const mm of [].concat(m.material || [])) { if (!mm.userData?.shared) { mm.map?.dispose?.(); mm.dispose(); } } }); });
    const quizBox = h('section', { class: 'card vz3-quiz', hidden: true, 'aria-label': 'שאלה קצרה' });
    const playB = btn('▶ הפעל', () => { sfx.click(); if (t >= script.duration - 0.01) { t = 0; evIdx = -1; } playing = !playing; playB.textContent = playing ? '⏸ השהה' : '▶ הפעל'; }, 'btn small primary');
    const stepB = btn('הצעד הבא', () => { sfx.click(); playing = false; playB.textContent = '▶ הפעל'; const nx = script.events.find(e => e[0] > t + 0.05); t = nx ? nx[0] + 0.01 : script.duration; if (!nx) finished(); }, 'btn small');
    const againB = btn('מההתחלה', () => { sfx.click(); reset(); }, 'btn small');
    const quizB = btn('לשאלה קצרה', () => { sfx.click(); showQuiz(); }, 'btn small');
    function reset() { t = 0; evIdx = -1; playing = false; playB.textContent = '▶ הפעל'; quizBox.hidden = true; if (reduced()) t = script.hold; }
    function finished() { playing = false; playB.textContent = '▶ הפעל'; t = script.duration; showQuiz(); }
    function select(id) {
      drop(made); made = []; cur = SIGNS.find(s => s.id === id); const ctx = { C, W, scene, car: null };
      made = cap(() => { car = W.vehicle('ev', { name: 'me' }); scene.add(car); ctx.car = car; script = cur.build(ctx); arrow = makeArrow(script.sign, script.target, cur.arrow); scene.add(arrow); });
      W.label(car, 'אתה', { size: 1.2, bg: 'rgba(42,111,219,.95)' });
      view.driver = null; view.goal = { ...script.cam, target: script.cam.target.clone() }; reset(); quizBox.hidden = true;
      say(`תמרור ${cur.n}: ${short(cur.n)}. ${script.events[0][1]}`);
    }
    // ---- the question: the official wording is the right answer, the other four signs' official meanings are the wrong ones
    function showQuiz() {
      const n = cur.n, opts = [n, ...SIGNS.filter(s => s.n !== n).map(s => s.n).slice(0, 3)];
      for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
      const img = SG.img[n] && h('img', { class: 'qimg', src: new URL('../../img/q/' + SG.img[n], import.meta.url).href, alt: `תמרור מספר ${n}`, width: 240, height: 135 });
      const fb = h('div', { 'aria-live': 'polite' }), buttons = opts.map(o => { const b = h('button', { type: 'button', class: 'btn answer', text: short(o), lang: 'he', dir: 'rtl' }); b.onclick = () => {
        buttons.forEach(x => { x.disabled = true; }); const ok = o === n; b.classList.add(ok ? 'ok' : 'bad'); buttons[opts.indexOf(n)].classList.add('ok'); ok ? sfx.correct() : sfx.wrong(); done.add(cur.id);
        fb.replaceChildren(h('p', { class: ok ? 'good-note' : 'warn-note', text: ok ? '✓ נכון.' : '✗ לא נכון. התשובה הנכונה מסומנת.' }), h('p', { class: 'small', lang: 'he', dir: 'rtl', text: `תמרור ${n} – ${full(n)}` }),
          h('p', { class: 'small' }, h('a', { href: SG.src.url, target: '_blank', rel: 'noopener', class: 'chip', text: 'לוח התמרורים (gov.il)' })),
          h('div', { class: 'row tight' }, btn('התמרור הבא', () => { sfx.click(); select(SIGNS[(SIGNS.indexOf(cur) + 1) % SIGNS.length].id); chips.querySelectorAll('button').forEach((c, i) => c.setAttribute('aria-pressed', String(SIGNS[i] === cur))); }, 'btn small primary'), btn('לצפות שוב', () => { sfx.click(); reset(); }, 'btn small')));
        say(`${ok ? 'נכון' : 'לא נכון'}. תמרור ${n}: ${short(n)}.`); }; return b; });
      quizBox.replaceChildren(h('h3', { class: 'h3', text: 'מה פירוש התמרור?' }), img || '', h('div', { class: 'stack' }, buttons), fb); quizBox.hidden = false; quizBox.scrollIntoView?.({ block: 'nearest' }); say('שאלה: מה פירוש התמרור? ארבע תשובות.');
    }
    const chips = chipGroup(SIGNS.map(s => [s.id, s.chip]), SIGNS[0].id, select);
    const cams = chipGroup([['three', 'מבט חצי'], ['top', 'מלמעלה'], ['drv', 'מבט הנהג']], 'three', k => {
      if (k === 'drv') { view.driver = car; view.goal = null; } else { view.driver = null; const c = script.cam; view.goal = k === 'top' ? { yaw: 0, pitch: 1.45, dist: c.dist * 0.9, target: c.target.clone() } : { ...c, target: c.target.clone() }; } });
    ctl.append(chips, h('div', { class: 'row tight' }, playB, stepB, againB, quizB), cams, quizBox);
    C.onFrame((dt, now) => {
      if (!script) return; if (playing) { t = Math.min(script.duration, t + dt); if (t >= script.duration) finished(); }
      script.update(t); arrow.userData.pulse(now);
      let k = -1; script.events.forEach((e, i) => { if (t >= e[0]) k = i; }); if (k !== evIdx) { evIdx = k; if (k >= 0) say(script.events[k][1]); }
    });
    Object.assign(view, { yaw: 0.9, pitch: 0.42, dist: 50 }); select(SIGNS[0].id);
  });
}
