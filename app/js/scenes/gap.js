// The 1-second gap (TR 49(ב)); reaction/braking distance – bank questions 811, 809. Ported from the legacy 3D scene onto real models.
// The road and the scenery scroll past at the chosen speed while the two cars stay in place; the green strip is the one-second gap in metres.
import { THREE, fig3, chipGroup, chip, sfx, label, VEHICLES } from '../kit3d.js';
import { h } from '../ui.js';
import { noseEye } from './_junction.js';

export default function gap3d() {
  return fig3('שנייה אחת – כמה מטרים זה?', 'לפי תקנה 49(ב); מרחק תגובה ובלימה – שאלות 811, 809 במאגר', ({ C, W, ctl, say }) => {
    const { view, scene } = C, LANE = 1.9, HB = VEHICLES.hatch.L / 2, HF = VEHICLES.sedan.L / 2, Z = 140;
    W.env({ ground: 'grass', size: 260, shadowSize: 45 });
    W.roadZ({ z0: -Z, z1: Z, centre: 'none' });
    const dashes = W.dashes(0, -Z, Z, { len: 3, gap: 6 }), period = Math.ceil((2 * Z) / 9) * 9;
    // scenery that scrolls: trees every 20 m and houses every 35 m on both sides
    const scroll = [], r = (k) => ((k * 7919) % 13) / 13;
    const HOUSES = ['city/building-type-a', 'city/building-type-c', 'city/building-type-d', 'city/building-type-f', 'city/building-type-g', 'city/building-type-h'];
    for (const s of [-1, 1]) {
      for (let k = 0; k < 14; k++) scroll.push({ g: W.prop(k % 2 ? 'city/tree-large' : 'city/tree-small', { scale: 9, x: s * 9.6, z: 0, ry: k }), z: -Z + k * 20 + (s > 0 ? 7 : 0) });
      for (let k = 0; k < 8; k++) scroll.push({ g: W.prop(HOUSES[(k + (s > 0 ? 2 : 0)) % HOUSES.length], { scale: 9, x: s * (35 + r(k) * 3), z: 0, ry: s < 0 ? Math.PI / 2 : -Math.PI / 2 }), z: -Z + k * 35 + (s > 0 ? 12 : 0) });
    }
    view.clampX = 29;
    const back = W.vehicle('ev', { name: 'me' }), front = W.vehicle('evsedan', { name: 'ahead' }); back.position.set(LANE, 0, 0); front.position.set(LANE, 0, -20); scene.add(back, front);
    W.label(back, 'אתה', { size: 1.3, bg: 'rgba(42,111,219,.95)' });
    const span = W.zone(LANE, -10, 3.0, 1, 0x2ecc71, { opacity: 0.6, y: 0.06 });
    let lab = label('', { size: 1.3 }), shown = '', eng = null, engOn = false, off = 0;
    const rg = h('input', { id: 'vz3-v', type: 'range', min: 20, max: 120, step: 10, value: 90, 'aria-label': 'מהירות' }), out = h('output', { for: 'vz3-v', class: 'vz-out' });
    const st = { v: 90, m: 25, dist: 25 };
    const run = () => { const v = +rg.value, m = v / 3.6; st.v = v; st.m = m; out.textContent = `${v} קמ"ש`;
      say(`במהירות ${v} קמ"ש הרכב עובר כ־${Math.round(m)} מטר בשנייה (${v} חלקי 3.6). זה הרווח המינימלי לפי החוק – שנייה אחת. מרחק העצירה (תגובה + בלימה) גדול יותר וגדל עם המהירות.`);
      eng?.set(v / 130); };
    rg.addEventListener('input', run); rg.addEventListener('change', () => sfx.click());
    const engB = chip('צליל מנוע', false, () => { engOn = !engOn; engB.setAttribute('aria-pressed', String(engOn)); if (engOn) { eng = sfx.engine(); eng.set(st.v / 130); } else { eng?.stop(); eng = null; } });
    C.onDispose(() => eng?.stop());
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    C.onFrame((dt, now) => {
      if (view.driver) noseEye(back);
      st.dist += (st.m - st.dist) * (reduce ? 1 : Math.min(1, dt * 6));   // smooth growth of the gap
      const g = st.dist; front.position.z = -(HB + g + HF);
      span.scale.set(1, g, 1); span.position.set(LANE, 0.06, -(HB + g / 2));
      if (shown !== Math.round(g)) { shown = Math.round(g); scene.remove(lab); lab.material.map?.dispose(); lab = label(`${shown} מ׳`, { size: 1.5, bg: 'rgba(30,140,80,.92)' }); scene.add(lab); }
      lab.position.set(LANE, 3.4, -(HB + g / 2));
      if (!reduce) { const d = st.m * dt; off += d; for (const q of dashes) { q.position.z += d; if (q.position.z > Z) q.position.z -= period; }
        for (const q of scroll) { let z = q.z + off; z = ((z + Z) % (2 * Z) + 2 * Z) % (2 * Z) - Z; q.g.position.z = z; } }
      else for (const q of scroll) q.g.position.z = q.z;
      view.target.set(LANE, 0.5, -(g / 2)); view.dist = 18 + g * 0.6; W.followSun(0, -g / 2);
    });
    Object.assign(view, { yaw: 1.05, pitch: 0.35, dist: 33 });
    const cams = { side: { yaw: 1.05, pitch: 0.35 }, back: { yaw: 0.1, pitch: 0.3 }, top: { yaw: 0, pitch: 1.4 } };
    const camSel = chipGroup([['side', 'מבט צד'], ['back', 'מאחור'], ['top', 'מלמעלה'], ['drv', 'מבט הנהג']], 'side', k => {
      if (k === 'drv') { view.driver = back; view.goal = null; } else { view.driver = null; view.goal = { ...cams[k], dist: view.dist, target: null }; } });
    ctl.append(h('label', { for: 'vz3-v', class: 'lbl', text: 'מהירות:' }), h('div', { class: 'row tight' }, rg, out), h('div', { class: 'row tight' }, engB), camSel); run(); st.dist = st.m;
  });
}
