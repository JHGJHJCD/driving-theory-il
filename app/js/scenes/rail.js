// Approaching a railway crossing (TR 56(א), 117(ב), 72(א)(8), LT 130–132) – real crossing with rails, barriers, a train and the distances of the 2D diagram.
import { THREE, fig3, sfx, chipGroup, btn, label, rng, mat, slowTo, reduced, LANE, LANE_W } from '../kit3d.js';
import { h } from '../ui.js';

const RAIL = 0.72;                       // the nearest rail is at z = +RAIL (traffic comes from +Z), the far one at -RAIL
const V = {
  near: ['קרוב למסילה', 'רכב שצריך לעצור עוצר לפני קו העצירה או המחסום, ואם אין – לפחות 4 מטר לפני הפס הקרוב (תקנה 56(א)). הולך רגל לא מתקרב יותר מ־6 מטר לפס הקרוב כשאין מחסום (תקנה 117(ב)). אסור לעצור ולחנות 20 מטר לפני המפגש ו־20 אחריו (תקנה 72(א)(8)). המרחקים באיור לפי קנה מידה.'],
  far: ['תמרורי האזהרה', 'שלושה תמרורי אזהרה לפני מפגש מסילת ברזל: 130 בכ־300 מטר, 131 בכ־200 מטר ו־132 בכ־100 מטר לפני המפגש. מהאזהרה ועד אחרי המפגש – אסור לעקוף.'],
};

export default function rail3d() {
  return fig3('מתקרבים למפגש מסילת ברזל', 'לפי תקנות 56(א), 117(ב), 72(א)(8) ותמרורים 130, 131 ו־132', ({ C, W, ctl, say }) => {
    const { scene, view } = C, RW = LANE_W, PAVE = 4, Z0 = -90, Z1 = 340;
    W.env({ ground: 'grass', size: 300, shadowSize: 70 });
    W.asphalt(0, (Z0 + Z1) / 2, 2 * RW, Z1 - Z0); W.dashes(0, Z0, Z1); W.line(-RW + 0.25, Z0, Z1); W.line(RW - 0.25, Z0, Z1);
    for (const s of [-1, 1]) W.kerb(s * (RW + PAVE / 2), (Z0 + Z1) / 2, PAVE, Z1 - Z0);
    // track across the road
    for (const o of [-RAIL, RAIL]) W.box(0, 0.15, o, 150, 0.12, 0.12, 0x9aa0a8, { metalness: 0.6, roughness: 0.4 });
    for (let x = -60; x <= 60; x += 0.65) W.box(x, 0.06, 0, 0.28, 0.1, 2.8, 0x5a4636, { roughness: 1 });
    for (const s of [-1, 1]) W.box(s * (RW + 33), 0.05, 0, 58, 0.1, 3.6, 0x8d8b86, { roughness: 1 });
    // houses and trees, kept clear of the crossing
    const r = rng(33), HOUSES = ['city/building-type-a', 'city/building-type-b', 'city/building-type-c', 'city/building-type-d', 'city/building-type-e', 'city/building-type-f'];
    view.clampX = RW + PAVE + 3.5;
    for (const side of [-1, 1]) for (let z = Z0 + 10; z < Z1 - 10; z += 17 + r() * 8) { if (Math.abs(z) < 26) continue;
      W.prop(HOUSES[Math.floor(r() * HOUSES.length)], { scale: 8.5 + r() * 2, x: side * (RW + PAVE + 9 + r() * 3), z, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
      W.prop(r() < .5 ? 'city/tree-large' : 'city/tree-small', { scale: 8 + r() * 3, x: side * (RW + PAVE + 1.2), z: z + 7, ry: r() * 6 }); }
    // barriers (right lane: arm from the right-hand post, approach side z=+3; left lane: from the left post at z=-3) with flashing lamps
    const arms = [], lamps = [], lampM = [new THREE.MeshStandardMaterial({ color: 0x400, emissive: 0xff1a1a, emissiveIntensity: 0, roughness: .3 }), new THREE.MeshStandardMaterial({ color: 0x400, emissive: 0xff1a1a, emissiveIntensity: 0, roughness: .3 })];
    const barrier = (px, pz, dir) => {   // dir: -1 = the arm reaches toward -x (right-hand post)
      const g = new THREE.Group(); g.position.set(px, 0, pz); scene.add(g);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 0.3), mat(0x2f343b)); post.position.y = 0.65; post.castShadow = true; g.add(post);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), mat(0xe8e8e8)); pole.position.set(0, 1.6, dir * -0.0 + 0.5); pole.castShadow = true; g.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.2), mat(0x1a1c20)); head.position.set(0, 3.4, 0.5); g.add(head);
      lampM.forEach((m, i) => { const l = new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), m); l.position.set((i ? 1 : -1) * 0.13, 3.4, 0.61); g.add(l); const l2 = l.clone(); l2.rotation.y = Math.PI; l2.position.z = 0.39; g.add(l2); });
      const pivot = new THREE.Group(); pivot.position.set(0, 1.2, 0); g.add(pivot);
      for (let i = 0; i < 8; i++) { const seg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.1), mat(i % 2 ? 0xf2f2f2 : 0xd62828)); seg.position.set(dir * (0.25 + i * 0.5), 0, 0); seg.castShadow = true; pivot.add(seg); }
      arms.push({ pivot, dir, a: 0 }); };
    barrier(RW + 0.6, 3.6, -1); barrier(-RW - 0.6, -3.6, 1);
    const RAISED = 1.45;
    const setArm = (A, k) => { A.a = k; A.pivot.rotation.z = -A.dir * RAISED * (1 - k); };   // k: 0 raised … 1 lowered
    arms.forEach(a => setArm(a, 0));
    // train: loco + car, running along X (front toward +X)
    const train = new THREE.Group(); scene.add(train); const loco = W.vehicle('loco'), car = W.vehicle('train'); loco.position.z = 0; car.position.z = 14.6; train.add(loco, car); train.rotation.y = -Math.PI / 2; train.position.set(-90, 0, 0); train.visible = false;
    // warning sign before the crossing, the person, markers
    W.sign('rail', { x: RW + PAVE - 0.7, z: 16, ry: -Math.PI / 2 + 0.25, size: 1.3 });
    let made = [], pulse = [], mode = 'near', seq = null;
    const cap = f => { const n = scene.children.length; f(); return scene.children.slice(n); };
    const drop = arr => arr.forEach(o => { scene.remove(o); o.traverse(m => { if (m.userData?.shared) return; m.geometry?.dispose?.(); for (const mm of [].concat(m.material || [])) { if (!mm.userData?.shared) { mm.map?.dispose?.(); mm.dispose(); } } }); });
    const lab = (t, x, y, z, bg = 'rgba(18,28,48,.9)', size = 1.4) => { const l = label(t, { size, bg }); l.position.set(x, y, z); scene.add(l); return l; };
    // board with diagonal stripes for signs 130/131/132 (300 / 200 / 100 m): 3, 2, 1 stripes; drawn here
    const board = (n, x, z) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#c8102e'; g.lineWidth = 12; g.beginPath();
      for (let i = 0; i < n; i++) { const o = 28 + i * 36 - (n - 1) * 18 + 18; g.moveTo(o - 40, 120); g.lineTo(o + 40, 8); } g.stroke(); g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = -Math.PI / 2 + 0.2;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 8), mat(0x8d949c, { metalness: .5 })); pole.position.y = 2.1; const f = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), new THREE.MeshStandardMaterial({ map: t, roughness: .5, side: THREE.DoubleSide })); f.position.set(0, 3.6, 0.07); grp.add(pole, f); grp.traverse(o => { o.castShadow = true; }); scene.add(grp); return grp; };
    const build = k => { mode = k; made = cap(() => {
      if (k === 'near') {
        const zx = RW - 1.25; W.stopLine(LANE, RAIL + 4, RW - 0.7); lab("4 מ' – עצירה", LANE - 1.2, 2.4, RAIL + 4, 'rgba(30,60,120,.92)');
        const before = W.zone(zx, RAIL + 10, 2.5, 20, 0xe5483f, { opacity: 0.5, y: 0.08 }), after = W.zone(zx, -RAIL - 10, 2.5, 20, 0xe5483f, { opacity: 0.5, y: 0.08 }); pulse = [before, after];
        lab("20 מ' – אסור לעצור ולחנות", zx - 1, 7.5, RAIL + 14, 'rgba(170,40,35,.92)', 1.5); lab("20 מ'", zx, 4.2, -RAIL - 10, 'rgba(170,40,35,.92)', 1.5);
        const ped = W.person(3, { anim: 'idle' }); ped.position.set(RW + 1.4, 0.16, RAIL + 6); ped.rotation.y = Math.PI * 0.5 + 0.3; scene.add(ped);
        W.flat(RW + PAVE / 2, RAIL + 6, PAVE, 0.15, 0xd62828, { y: 0.172 }); lab("6 מ' – הולך רגל", RW + 1.4, 5.2, RAIL + 6, 'rgba(120,70,0,.92)', 1.3);
        const post = (z) => W.post(RW + 0.4, z, '', { color: 0xf5b301 }); [RAIL, RAIL + 4, RAIL + 20, -RAIL - 20].forEach(post);
      } else { pulse = []; [[130, 300, 3], [131, 200, 2], [132, 100, 1]].forEach(([n, m, st]) => { const z = RAIL + m; board(st, RW + 1.7, z); lab(`${n}: ~${m} מ'`, RW + 1.7, 9, z, 'rgba(18,28,48,.92)', 5); }); lab('מפגש', 0, 6, 0, 'rgba(18,28,48,.92)', 3.4); }
    }); };
    const camFor = k => k === 'near' ? { yaw: 0.9, pitch: 0.55, dist: 44, target: new THREE.Vector3(1, 0, 8) } : { yaw: 1.05, pitch: 0.4, dist: 250, target: new THREE.Vector3(1, 0, 150) };
    const run = k => { drop(made); made = []; build(k); view.driver = null; view.clampX = k === 'far' ? null : RW + PAVE + 3.5; view.goal = camFor(k); say(V[k][1]); };
    // a train passes: lamps flash, arms come down, the train crosses, arms go up
    const go = () => { seq = { t: 0 }; train.position.x = -90; train.visible = true; sfx.crossingBell(); setTimeout(() => sfx.train(), 3000); };
    const goB = btn('רכבת עוברת', go, 'btn small primary');
    C.onFrame((dt, now) => {
      const o = 0.4 + 0.2 * Math.sin(now * 3); for (const z of pulse) z.material.opacity = o;
      if (seq) { seq.t += dt * (reduced() ? 4 : 1); const t = seq.t, flash = (Math.floor(now * 2.4) % 2) ? 2.4 : 0.2;
        lampM[0].emissiveIntensity = t < 11 ? flash : 0; lampM[1].emissiveIntensity = t < 11 ? 2.6 - flash : 0;
        const down = t < 1.5 ? 0 : t < 3 ? (t - 1.5) / 1.5 : t < 9 ? 1 : t < 10.5 ? 1 - (t - 9) / 1.5 : 0; arms.forEach(a => setArm(a, down));
        if (t > 3 && t < 9) train.position.x = -90 + (t - 3) * 30; if (t >= 11) { seq = null; train.visible = false; lampM.forEach(m => { m.emissiveIntensity = 0; }); arms.forEach(a => setArm(a, 0)); } }
    });
    Object.assign(view, { yaw: 0.9, pitch: 0.55, dist: 44 }); view.target.set(1, 0, 8); view.max = 260;
    const sel = chipGroup(Object.keys(V).map(k => [k, V[k][0]]), 'near', run);
    const camSel = chipGroup([['auto', 'מבט חצי'], ['top', 'מלמעלה'], ['side', 'מהצד']], 'auto', k => { const b = camFor(mode); view.driver = null; view.goal = k === 'auto' ? b : k === 'top' ? { ...b, yaw: 0, pitch: 1.45 } : { ...b, yaw: 1.5, pitch: 0.22 }; view.clampX = mode === 'far' ? null : RW + PAVE + 3.5; });
    ctl.append(sel, h('div', { class: 'row tight' }, goB), camSel); run('near');
  });
}
