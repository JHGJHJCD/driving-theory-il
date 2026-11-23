// "How fast may I go here?" (TR 54(א), 54(ב)) – the same road types, vehicle types and numbers as the 2D table explorer in viz.js,
// shown on a real road of each type with the matching speed sign. No number here is made up: n comes from the same table.
import { THREE, fig3, chipGroup, label, reduced } from '../kit3d.js';
import { h } from '../ui.js';
import { noseEye } from './_junction.js';

const ROADS = [['city', 'דרך עירונית'], ['rural', 'דרך שאינה עירונית'], ['div', 'שאינה עירונית, עם שטח הפרדה בנוי'], ['fwy', 'דרך מהירה']];
const VEH = [['car', 'רכב מנועי רגיל', [50, 80, 90, 110]], ['bus', 'אוטובוס (לא זעיר)', [50, 80, 90, 100]], ['heavy', 'רכב מסחרי מעל 12,000 ק"ג', [50, 80, 80, 80]], ['slow', 'רכב איטי וטרקטור', [40, 40, 40, 0]]];
const MODEL = { car: 'evsedan', bus: 'bus', heavy: 'lorry', slow: 'tractor' };

// "not allowed" face (white disc, red ring, black cross) on a pole – drawn here, same pole as W.sign
function noSign(W, x, z) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.beginPath(); g.arc(128, 128, 122, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 24; g.strokeStyle = '#c8102e'; g.stroke();
  g.lineWidth = 26; g.lineCap = 'round'; g.strokeStyle = '#111'; g.beginPath(); g.moveTo(78, 78); g.lineTo(178, 178); g.moveTo(178, 78); g.lineTo(78, 178); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const grp = new THREE.Group(); grp.position.set(x, 0, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.6, 8), new THREE.MeshStandardMaterial({ color: 0x8d949c, metalness: 0.5, roughness: 0.4 })); pole.position.y = 1.8; grp.add(pole);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, roughness: 0.5 })); face.position.set(0, 3.2, 0.06); grp.add(face);
  W.scene.add(grp); return grp;
}

export default function speed3d() {
  return fig3('כמה מותר כאן?', 'לפי תקנה 54(א) ו־54(ב) – כשאין תמרור מהירות אחר', ({ C, W, ctl, say }) => {
    const { view, scene } = C;
    W.env({ ground: 'grass', size: 300, shadowSize: 60 }); view.max = 110; view.min = 8;
    let objs = [], loops = [], veh = null;
    const rm = o => { scene.remove(o); o.traverse(m => { if (m.userData?.shared) return; m.geometry?.dispose?.(); for (const x of [].concat(m.material || [])) { if (x.userData?.shared) continue; x.map?.dispose?.(); x.dispose?.(); } }); };

    // ---- the five road layouts; each returns {x: lane x of the driver, signX}
    const L = {
      city: () => { W.roadZ({ z0: -130, z1: 110, centre: 'dash' }); W.street({ z0: -130, z1: 90, xLeft: -9.2, xRight: 9.2, seed: 3, density: 0.8 }); return { x: 1.9, signX: 5.0 }; },
      rural: () => { W.roadZ({ z0: -160, z1: 120, centre: 'dash', kerbs: false }); W.trees([[-9, 30], [-14, 8], [10, -18], [15, 4], [-12, -34], [11, -52], [-10, -70], [13, 40], [-16, 60], [12, 78]]); view.clampX = null; return { x: 1.9, signX: 5.6 }; },
      div: () => {
        const len = 280, cz = -20, wc = 7.6, sep = 4, cx = sep / 2 + wc / 2;
        for (const s of [-1, 1]) { W.asphalt(s * cx, cz, wc, len); W.line(s * (cx - wc / 2 + 0.25), cz - len / 2, cz + len / 2); W.line(s * (cx + wc / 2 - 0.25), cz - len / 2, cz + len / 2); W.dashes(s * cx, cz - len / 2, cz + len / 2); }
        W.kerb(0, cz, sep, len, { h: 0.2 }); for (let z = cz - len / 2 + 6; z < cz + len / 2; z += 9) W.prop('city/tree-small', { scale: 6, x: 0, z });
        W.trees([[-14, 30], [16, 8], [-16, -34], [17, -52], [-13, -70], [15, 50], [-15, 70]]); view.clampX = null;
        return { x: cx + wc / 4, signX: cx + wc / 2 + 1.6, mid: cx }; },
      fwy: () => {
        const len = 300, cz = -30, wc = 11.4, cx = 0.6 + wc / 2;
        for (const s of [-1, 1]) { W.asphalt(s * cx, cz, wc, len); W.line(s * (cx - wc / 2 + 0.25), cz - len / 2, cz + len / 2); W.line(s * (cx + wc / 2 - 0.25), cz - len / 2, cz + len / 2); for (const k of [-1, 1]) W.dashes(s * cx + k * 3.8, cz - len / 2, cz + len / 2); W.asphalt(s * (cx + wc / 2 + 1.5), cz, 3, len); }
        W.box(0, 0.45, cz, 0.6, 0.9, len, 0xb9bcc2, { roughness: 0.9 });                  // concrete barrier
        W.trees([[-22, 30], [24, 8], [-24, -34], [25, -52], [-23, -70], [26, 50], [-24, 70]]); view.clampX = null;
        return { x: cx + 3.8, signX: cx + wc / 2 + 3.4 }; },
      shared: () => {
        W.kerb(0, -10, 8, 250, { h: 0.03 });                                                // one paved surface, no kerb between road and pavement
        W.street({ z0: -120, z1: 90, xLeft: -4.6, xRight: 4.6, seed: 12, density: 0.9 });
        for (const z of [-6, -24]) for (const s of [-1, 1]) W.cone(s * 3.6, z);
        for (const [i, x, z, d] of [[3, -2.8, -10, 1], [7, 3.0, -30, -1]]) { const p = W.person(i, { anim: 'walk' }); p.position.set(x, 0, z); p.rotation.y = d > 0 ? Math.PI : 0; scene.add(p); const base = z; loops.push((dt, now) => { p.position.z = base + Math.sin(now * 0.4 + i) * 6; p.rotation.y = Math.cos(now * 0.4 + i) > 0 ? Math.PI : 0; }); }
        return { x: 1.9, signX: 3.4 }; },
    };
    let roadSel = 'city', vehSel = 'car', sharedOn = false;
    const build = () => {
      objs.forEach(rm); objs = []; loops = []; veh = null; const b0 = scene.children.length; view.clampX = null; view.driver = null;
      const vi = VEH.find(x => x[0] === vehSel), ri = ROADS.findIndex(x => x[0] === roadSel), n = sharedOn ? 30 : vi[2][ri];
      const lay = L[sharedOn ? 'shared' : roadSel](), nx = lay.x;
      if (n) W.sign('speed', { x: lay.signX, z: 6, n, size: 2.0, h: 3.2 }); else noSign(W, lay.signX, 6);
      const car = W.vehicle(MODEL[vehSel]); car.position.set(nx, 0, n ? 24 : 16); scene.add(car); veh = car;
      const lab = label(n ? `${n} קמ"ש לכל היותר` : 'אסור לנסוע כאן', { size: 1.3, bg: n ? 'rgba(30,140,80,.92)' : 'rgba(190,40,40,.95)' }); lab.position.set(0, (car.userData.dims?.H || 1.6) + 1.4, 0); car.add(lab);
      const v = n / 3.6 * 0.35;      // the car crawls past the sign at a pace that grows with the limit (display only)
      loops.push((dt, now) => { if (!n || reduced()) return; car.position.z -= v * dt; if (car.position.z < -45) car.position.z = 30; });
      objs = scene.children.slice(b0);
      W.followSun(nx, 0);
      say(sharedOn ? 'ברחוב משולב או באזור מיתון תנועה: עד 30 קמ"ש (תקנה 54(ב)).' : n ? `${vi[1]} ב${ROADS[ri][1]}: עד ${n} קמ"ש (תקנה 54(א)).` : `${vi[1]}: אסור לנסוע בדרך מהירה (תקנה 54(א)).`);
      T.set(nx, 0, 6); view.target.copy(T);
    };
    const T = new THREE.Vector3(0, 0, 6);
    const sel = (id, opts, on) => h('select', { id, onchange: e => on(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, text: l })));
    const sv = sel('vz3-veh', VEH, v => { vehSel = v; build(); }), sr = sel('vz3-road', ROADS, v => { roadSel = v; build(); });
    const shared = h('input', { type: 'checkbox', id: 'vz3-shared', onchange: e => { sharedOn = e.target.checked; build(); } });
    ctl.append(h('div', { class: 'field' }, h('label', { for: 'vz3-veh', text: 'סוג הרכב' }), sv), h('div', { class: 'field' }, h('label', { for: 'vz3-road', text: 'סוג הדרך' }), sr),
      h('label', { class: 'check' }, shared, h('span', { text: 'רחוב משולב / אזור מיתון תנועה' })));
    const cams = { three: { yaw: 0.7, pitch: 0.42, dist: 30 }, top: { yaw: 0, pitch: 1.45, dist: 44 }, back: { yaw: 0.1, pitch: 0.25, dist: 20 } };
    Object.assign(view, cams.three);
    const camSel = chipGroup([['three', 'מבט חצי'], ['top', 'מלמעלה'], ['back', 'מאחורי הרכב'], ['drv', 'מבט הנהג']], 'three', k => {
      if (k === 'drv') { view.driver = veh; view.goal = null; } else { view.driver = null; view.goal = { ...cams[k], target: T.clone() }; } });
    ctl.append(camSel);
    C.onFrame((dt, now) => { for (const f of loops) f(dt, now); if (view.driver && veh) { view.driver = veh; noseEye(veh); } });
    build();
  });
}
