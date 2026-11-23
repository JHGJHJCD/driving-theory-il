// Where stopping and parking are forbidden (TR 72(א)) – real street, the object and the no-stopping zone with its distances.
// Numbers and captions are the ones of the 2D diagram (viz.js PK); the size of the drawn object is only illustrative.
import { THREE, fig3, chipGroup, label, rng, LANE, LANE_W } from '../kit3d.js';
import { h } from '../ui.js';

const PK = [['junction', 'צומת', 12, 12, 'בתוך הצומת ו־12 מטר ממנו', '72(א)(3)'], ['zebra', 'מעבר חצייה', 12, 0, 'על המעבר ו־12 מטר לפניו', '72(א)(6)'],
  ['rail', 'מסילת ברזל', 20, 20, 'מ־20 מטר לפני המפגש ועד 20 מטר אחריו', '72(א)(8)'], ['bus', 'תחנת אוטובוס בלי סימון', 20, 20, '20 מטר לפני התמרור ו־20 מטר אחריו', '72(א)(12)'],
  ['bridge', 'גשר או מנהרה', 50, 50, 'עליהם ו־50 מטר לפניהם ואחריהם', '72(א)(11)']];
const OBJ = { junction: 2 * LANE_W, zebra: 3, rail: 5, bus: 1, bridge: 14 };   // drawn length of the object along the road (m), illustrative

export default function parking3d() {
  return fig3('איפה אסור לעצור ולהעמיד רכב?', 'לפי תקנה 72(א) – הסעיף מופיע ליד כל מקום', ({ C, W, ctl, say }) => {
    const { scene, view } = C, RW = LANE_W, PAVE = 4, ZL = 160;      // RW: half road width
    W.env({ ground: 'grass', size: 240, shadowSize: 80 });
    W.asphalt(0, 0, 2 * RW, 2 * ZL); W.dashes(0, -ZL, ZL);
    // houses and trees along the road (kept clear of the middle, where the objects are)
    const r = rng(21), HOUSES = ['city/building-type-a', 'city/building-type-b', 'city/building-type-c', 'city/building-type-d', 'city/building-type-e', 'city/building-type-f'];
    view.clampX = RW + PAVE + 3.5;
    for (const side of [-1, 1]) { for (let z = -ZL + 8; z < ZL - 8; z += 13 + r() * 5) { if (Math.abs(z) < 14 || (Math.abs(z) < 120 && side > 0 && z > -12 && z < 12)) continue;
      W.prop(HOUSES[Math.floor(r() * HOUSES.length)], { scale: 8.5 + r() * 2, x: side * (RW + PAVE + 9 + r() * 3), z, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
      W.prop(r() < .5 ? 'city/tree-large' : 'city/tree-small', { scale: 8 + r() * 3, x: side * (RW + PAVE + 1.2), z: z + 6, ry: r() * 6 }); } }
    let made = [], pulse = [], me = null;
    const cap = f => { const n = scene.children.length; f(); return scene.children.slice(n); };
    const drop = arr => arr.forEach(o => { scene.remove(o); o.traverse(m => { if (m.userData?.shared) return; m.geometry?.dispose?.(); for (const mm of [].concat(m.material || [])) { if (!mm.userData?.shared) { mm.map?.dispose?.(); mm.dispose(); } } }); });
    // kerbs/pavements along both sides, skipping the given z-gaps
    const kerbs = gaps => { for (const s of [-1, 1]) { let a = -ZL; const segs = []; for (const [g0, g1] of gaps) { segs.push([a, g0]); a = g1; } segs.push([a, ZL]);
      for (const [z0, z1] of segs) if (z1 - z0 > 0.5) W.kerb(s * (RW + PAVE / 2), (z0 + z1) / 2, PAVE, z1 - z0);
      } for (const s of [-1, 1]) { let a = -ZL; const segs = []; for (const [g0, g1] of gaps) { segs.push([a, g0]); a = g1; } segs.push([a, ZL]); for (const [z0, z1] of segs) if (z1 - z0 > 0.5) W.line(s * (RW - 0.25), z0, z1); } };
    const track = (cz) => { for (const o of [-0.72, 0.72]) W.box(0, 0.14, cz + o, 24, 0.12, 0.12, 0x9aa0a8, { metalness: 0.6, roughness: 0.4 });
      for (let x = -12; x <= 12; x += 0.65) W.box(x, 0.06, cz, 0.28, 0.1, 2.8, 0x5a4636, { roughness: 1 });
      for (const s of [-1, 1]) W.box(s * (RW + 4.2), 0.06, cz, 8.4, 0.12, 3.4, 0x8d8b86, { roughness: 1 }); };
    const build = k => { const obj = OBJ[k], p = PK.find(x => x[0] === k), b = p[2], a = p[3], h2 = obj / 2;
      made = cap(() => {
        if (k === 'junction') { kerbs([[-RW, RW]]); for (const s of [-1, 1]) { const x0 = s * RW, x1 = s * 90; W.asphalt((x0 + x1) / 2, 0, 90 - RW, 2 * RW); W.lineX(-RW + 0.25, x0, x1); W.lineX(RW - 0.25, x0, x1);
            for (const t of [-1, 1]) W.kerb(s * (RW + PAVE + (90 - RW - PAVE) / 2), t * (RW + PAVE / 2), 90 - RW - PAVE, PAVE); W.dashesX(0, x0, x1); } W.stopLine(LANE, RW + 0.3, 0.1); }
        else if (k === 'zebra') { kerbs([]); W.zebra(0, 0, 2 * RW - 0.8, { depth: 3, bar: 0.5, gap: 0.5 }); W.sign('crossing', { x: RW + PAVE - 0.6, z: 3.2, ry: -Math.PI / 2 + 0.2 }); }
        else if (k === 'rail') { kerbs([]); track(0); W.sign('rail', { x: RW + PAVE - 0.6, z: 9, ry: -Math.PI / 2 + 0.2, size: 1.2 }); }
        else if (k === 'bus') { kerbs([]); W.sign('info', { x: RW + PAVE - 0.8, z: 0, ry: -Math.PI / 2 + 0.2, text: 'אוטובוס', size: 1.1 }); W.box(RW + PAVE - 0.6, 1.2, -2.2, 0.15, 2.4, 3.2, 0x9ab6c8, { transparent: true, opacity: 0.45 }); W.box(RW + PAVE - 0.6, 2.45, -2.2, 1.4, 0.12, 3.4, 0x4a5058); }
        else if (k === 'bridge') { kerbs([[-h2, h2]]); const wat = W.flat(0, 0, 70, obj + 12, 0x3f7fb5, { y: 0.004, rough: 0.2 }); for (const s of [-1, 1]) W.box(s * (RW + 0.25), 0.55, 0, 0.5, 1.1, obj, 0xb7b2a6); for (const s of [-1, 1]) W.box(s * (RW + PAVE / 2 + 0.5), 0.1, 0, PAVE + 1, 0.2, obj, 0xb7b2a6); void wat; }
        // the no-stopping zone on the right-hand side: b before the object (toward +Z, where traffic comes from), a after it
        const zc = (b - a) / 2, zl = b + obj + a, zx = RW - 1.25, zone = W.zone(zx, zc, 2.5, zl, 0xe5483f, { opacity: 0.5, y: 0.08 }); pulse = [zone];
        const mk = (x, z) => W.post(x, z, '', { color: 0xf5b301 });
        for (const z of [h2 + b, h2, -h2, -(h2 + a)]) mk(RW + 0.5, z);
        const lab = (t, z) => { const l = label(t, { size: 1.5, bg: 'rgba(170,40,35,.92)' }); l.position.set(zx, 4.2, z); scene.add(l); };
        lab(b + " מ'", h2 + b / 2); if (a) lab(a + " מ'", -(h2 + a / 2));
      });
      const L = b + obj + a, zc = (b - a) / 2;
      view.goal = { yaw: view.yaw, pitch: 0.6, dist: 26 + L * 0.7, target: new THREE.Vector3(1, 0, zc) }; view.follow = null;
      say(`${p[1]}: אסור לעצור ולהעמיד רכב ${p[4]} (תקנה ${p[5]}). התנועה נוסעת קדימה בכביש (נתיב ימין); האורכים לפי קנה מידה, והעצם עצמו מצויר להמחשה.`); };
    let cur = 'junction';
    // ambient traffic: one car drives through the street, so the driver's view shows the zone from behind the wheel
    me = W.vehicle('hatch', { name: 'me' }); scene.add(me); me.position.set(LANE, 0, ZL); C.onFrame((dt) => { me.position.z -= 9 * dt; if (me.position.z < -ZL) me.position.z = ZL; });
    C.onFrame((dt, now) => { const o = 0.4 + 0.2 * Math.sin(now * 3); for (const z of pulse) z.material.opacity = o; });
    const cams = { three: { yaw: 0.9, pitch: 0.6 }, top: { yaw: 0, pitch: 1.45 }, side: { yaw: 1.5, pitch: 0.22 } };
    view.target.set(1, 0, 0); Object.assign(view, { yaw: 0.9, pitch: 0.6, dist: 60 }); view.max = 220;
    const run = k => { cur = k; drop(made); made = []; build(k); };
    const sel = chipGroup(PK.map(p => [p[0], p[1]]), 'junction', run);
    const camSel = chipGroup([['three', 'מבט חצי'], ['top', 'מלמעלה'], ['side', 'מהצד'], ['drv', 'מבט הנהג']], 'three', k => { if (k === 'drv') { view.driver = me; view.goal = null; } else { view.driver = null; const p = PK.find(x => x[0] === cur), L = p[2] + OBJ[cur] + p[3]; view.goal = { ...cams[k], dist: (k === 'top' ? 30 : 26) + L * (k === 'top' ? 0.95 : 0.7), target: new THREE.Vector3(1, 0, (p[2] - p[3]) / 2) }; } });
    ctl.append(sel, camSel); run('junction');
  });
}
