// Blind spots (Q800, Q733, TR 40(א)) – a three-lane road, the zones around the vehicle and a motorcyclist you can slide forward and back.
// The zones come from the 2D diagram (viz.js BL) and are illustrative, as its caption says; they are only converted from its pixels to metres.
import { THREE, fig3, chipGroup, label, LANE_W } from '../kit3d.js';
import { h } from '../ui.js';

// [name, width px, length px, zones [x, y, w, h] px (y>0 = behind the vehicle)] – identical to viz.js
const BL = {
  car: ['רכב פרטי', 14, 26, [[-60, 0, 50, 36], [10, 0, 50, 36]]],
  truck: ['משאית או אוטובוס', 22, 70, [[-60, -10, 46, 60], [14, -40, 50, 110], [-11, -72, 22, 36], [-11, 35, 22, 40]]],
  moto: ['אופנוע', 7, 18, [[-55, 2, 48, 28], [7, 2, 48, 28]]],
};
const REAL = { car: { L: 4.3, W: 1.85 }, truck: { L: 8.5, W: 2.5 }, moto: { L: 2.1, W: 0.8 } };   // metres, for drawing

export default function blind3d(ctx = {}) {
  return fig3('השטח המת: מי לא נראה במראה?', 'לפי שאלות 800 ו־733 במאגר ותקנה 40(א); גודל השטחים באיור להמחשה בלבד', ({ C, W, ctl, say }) => {
    const { scene, view } = C, L = 220, RW = 1.5 * LANE_W;
    W.env({ ground: 'grass', size: 200, shadowSize: 50 });
    W.asphalt(0, 0, 2 * RW, L); W.line(-RW + 0.25, -L / 2, L / 2); W.line(RW - 0.25, -L / 2, L / 2); W.dashes(-LANE_W / 2, -L / 2, L / 2); W.dashes(LANE_W / 2, -L / 2, L / 2);
    for (const s of [-1, 1]) W.kerb(s * (RW + 2), 0, 4, L);
    W.street({ z0: -L / 2, z1: L / 2, xLeft: -(RW + 4), xRight: RW + 4, seed: 8 });
    let k = ctx.lesson === 'moto' || (ctx.lesson === 'blind' && ctx.cls === 'A') ? 'moto' : ['heavy', 'bus'].includes(ctx.lesson) || (ctx.lesson === 'blind' && ['C1', 'C', 'D'].includes(ctx.cls)) ? 'truck' : 'car';
    let me = null, rider = null, zones = [], tag = null, tagState = null;
    const drop = o => { scene.remove(o); o.traverse(m => { if (m.userData?.shared) return; m.geometry?.dispose?.(); for (const mm of [].concat(m.material || [])) { if (!mm.userData?.shared) { mm.map?.dispose?.(); mm.dispose(); } } }); };
    const r = h('input', { id: 'vz3-pos', type: 'range', min: 0, max: 100, value: 70, 'aria-label': 'מיקום הרוכב בנתיב הימני' });
    rider = W.moto({ rider: true, color: 0x2563c9, riderIndex: 4 }); scene.add(rider); rider.position.x = LANE_W;
    const conv = (kind, [x, y, w, hh]) => { const [, wpx, lpx] = BL[kind], R = REAL[kind], hwp = wpx / 2, hwm = R.W / 2, kx = (LANE_W - hwm) / (48 - hwp), kz = R.L / lpx;
      const mx = px => Math.sign(px) * (hwm + (Math.abs(px) - hwp) * kx), xs = [x, x + w].map(mx).sort((a, b) => a - b); return { x0: xs[0], x1: xs[1], z0: y * kz, z1: (y + hh) * kz }; };
    const build = () => { if (me) drop(me); zones.forEach(drop); zones = [];
      me = k === 'moto' ? W.moto({ rider: true, color: 0xc9341f, riderIndex: 1 }) : W.vehicle(k === 'truck' ? 'lorry' : 'ev', { name: 'me' }); scene.add(me); W.label(me, 'אתה', { size: 1.4, bg: 'rgba(42,111,219,.95)' });
      for (const z of BL[k][3]) { const c = conv(k, z); zones.push(W.zone((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, c.x1 - c.x0, c.z1 - c.z0, 0xf5b301, { opacity: 0.5, y: 0.08 })); }
      if (view.driver) view.driver = me; };
    const run = () => { const [name, , l, zs] = BL[k], kz = REAL[k].L / l;
      const y = 215 - +r.value * 2.1, ry = y - 110, inZ = zs.some(([x, zy, ww, hh]) => 48 >= x && 48 <= x + ww && ry >= zy && ry <= zy + hh);
      rider.position.z = ry * kz; rider.userData.hid = inZ;
      const where = ry > l / 2 ? 'מאחוריך' : ry < -l / 2 ? 'לפניך' : 'לצידך';
      r.setAttribute('aria-valuetext', `הרוכב ${where}${inZ ? ', בשטח המת' : ', נראה'}`);
      if (tagState !== inZ) { if (tag) { rider.remove(tag); tag.material.map?.dispose(); tag.material.dispose(); } tagState = inZ;
        tag = label(inZ ? 'בשטח המת – לא נראה' : 'נראה', { size: 1.1, bg: inZ ? 'rgba(200,40,40,.95)' : 'rgba(30,140,80,.95)' }); tag.position.set(0, 3.4, 0); rider.add(tag); }
      say(`אתה ב${name} בנתיב האמצעי. רוכב בנתיב הימני ${where}. ${inZ ? 'הוא בשטח המת – לא תראה אותו במראה. לפני סטייה או פנייה מסובבים את הראש ובודקים.' : 'כרגע אפשר לראות אותו – במראה או ישירות.'}`); };
    C.onFrame((dt, now) => { const o = 0.4 + 0.18 * Math.sin(now * 3); for (const z of zones) z.material.opacity = o; });
    const T = new THREE.Vector3(1.2, 0, 1), cams = { three: { yaw: 0.75, pitch: 0.7, dist: 24 }, top: { yaw: 0, pitch: 1.45, dist: 28 }, side: { yaw: 1.5, pitch: 0.25, dist: 22 } };
    Object.assign(view, cams.three); view.target.copy(T); view.max = 90;
    const keys = Object.keys(BL), chips = chipGroup(keys.map(x => [x, BL[x][0]]), k, x => { k = x; build(); run(); });
    const camSel = chipGroup([['three', 'מבט חצי'], ['top', 'מלמעלה'], ['side', 'מהצד'], ['drv', 'מבט הנהג']], 'three', c => { if (c === 'drv') { view.driver = me; view.goal = null; } else { view.driver = null; view.goal = { ...cams[c], target: T.clone() }; } });
    r.addEventListener('input', run);
    ctl.append(chips, h('label', { for: 'vz3-pos', class: 'lbl', text: 'הזיזו את הרוכב:' }), r, camSel); build(); run();
  });
}
