// Stopping distance (textbook pp. 22–23: ~24 m at 50 km/h, ~77 m at 100 km/h) – ported from the legacy 3D scene onto real models.
// The distances are the official textbook figures; the split between reaction and braking distance is schematic, as before.
import { THREE, fig3, chipGroup, chip, btn, sfx, label, reduced, VEHICLES } from '../kit3d.js';
import { h } from '../ui.js';
import { noseEye } from './_junction.js';

export default function stopdist3d() {
  return fig3('מרחק העצירה', 'לפי ספר הלימוד הרשמי "נוהגים אחרת – נוהגים נכון" (הרשות הלאומית לבטיחות בדרכים ומשרד התחבורה), עמ׳ 22–23', ({ C, W, ctl, say }) => {
    const { view, scene } = C, P0 = 0, LANE = 1.9, TOT = { 50: 24, 100: 77 }, HALF = VEHICLES.hatch.L / 2;
    W.env({ ground: 'grass', size: 330, shadowSize: 60 });
    W.roadZ({ z0: -270, z1: 80, centre: 'dash' }); W.street({ z0: -150, z1: 70, xLeft: -9.2, xRight: 9.2, seed: 8, density: 0.6 });
    for (let m = 10; m <= 100; m += 10) W.post(-5.6, P0 - m, m % 20 === 0 ? m + ' מ׳' : null, { size: 0.9 });
    for (const [v, col] of [[50, 0xf5b301], [100, 0xe5483f]]) { const d = TOT[v], c = col;
      W.flat(0, P0 - d, 7.2, 0.5, c, { y: 0.05 });
      for (const s of [-1, 1]) W.box(s * 5.3, 1.6, P0 - d, 0.2, 3.2, 0.2, c); W.box(0, 3.2, P0 - d, 10.8, 0.25, 0.25, c);
      const l = label(`${v} קמ"ש: כ־${d} מ׳`, { size: 1.15, bg: v === 50 ? 'rgba(160,110,0,.92)' : 'rgba(170,40,35,.92)' }); l.position.set(0, 4.6, P0 - d); scene.add(l); }
    const car = W.vehicle('ev', { name: 'me' }); car.position.set(LANE, 0, P0 + 40); scene.add(car);
    const hazard = W.prop('cars/box', { scale: 1.8, x: LANE, z: 0 }); hazard.visible = false;
    const warn = label('סכנה!', { size: 1.4, bg: 'rgba(200,30,30,.95)' }); warn.position.set(LANE, 3.6, P0); warn.visible = false; scene.add(warn);
    const zones = []; const clearZones = () => { for (const z of zones) { scene.remove(z); z.geometry.dispose(); z.material.dispose(); } zones.length = 0; };
    let speed = 50, slow = false, st = null, eng = null;
    const kmh = v => v / 3.6;
    const info = 'ב־50 קמ"ש מרחק העצירה כ־24 מטר; ב־100 קמ"ש כ־77 מטר. מהירות כפולה – מרחק עצירה בערך משולש. מרחק העצירה הוא מרחק התגובה (מה שהרכב עובר עד שהנהג מגיב) ועוד מרחק הבלימה. החלוקה בין השניים בציור היא להמחשה בלבד; המספרים הרשמיים הם המרחק הכולל.';
    const reset = () => { st = null; clearZones(); hazard.visible = false; warn.visible = false; W.setBrake(car, false); car.position.set(LANE, 0, P0 + 40); eng?.stop(); eng = null; };
    const start = () => {
      reset(); const v = kmh(speed), D = TOT[speed], dr = v * 1.0, db = D - dr, a = v * v / (2 * db);
      zones.push(W.zone(LANE, P0 - dr / 2, 3.4, dr, 0xf5b301, { opacity: 0.6, y: 0.06 }), W.zone(LANE, P0 - dr - db / 2, 3.4, db, 0xe5483f, { opacity: 0.6, y: 0.06 }));
      hazard.position.set(LANE, 0, P0 - D - 1.0); hazard.visible = true;
      st = { v, D, dr, a, t: 0, front: P0 + 40 - HALF, phase: 'cruise', cur: v, done: false };
      if (reduced()) { st.front = P0 - D; car.position.z = st.front + HALF; st.done = true; warn.visible = true; W.setBrake(car, true); }
      else if (!eng) eng = sfx.engine();
      say(`${speed} קמ"ש. הנהג מבחין בסכנה בנקודה המסומנת, ורק אחרי זמן תגובה הוא מתחיל לבלום. מרחק העצירה: כ־${D} מטר. ${info}`);
    };
    const speedSel = chipGroup([[50, '50 קמ"ש'], [100, '100 קמ"ש']], 50, k => { speed = +k; reset(); say(info); });
    const goB = btn('הפעל', () => { sfx.click(); start(); }, 'btn small primary'), slowB = chip('הילוך איטי', false, () => { slow = !slow; slowB.setAttribute('aria-pressed', String(slow)); });
    const follow = { z: () => (st ? Math.min(P0 + 12, car.position.z) - 6 : P0 - 8) };
    const cams = { side: { yaw: 1.25, pitch: 0.34, dist: 46 }, back: { yaw: 0.2, pitch: 0.28, dist: 16 }, top: { yaw: 0, pitch: 1.45, dist: 70 } };
    view.follow = follow; Object.assign(view, { yaw: 1.25, pitch: 0.34, dist: 46 }); view.target.set(LANE, 1, P0 - 8); view.max = 120; view.clampX = 15;
    const camSel = chipGroup([['side', 'מבט צד'], ['back', 'מאחורי הרכב'], ['top', 'מלמעלה'], ['drv', 'מבט הנהג']], 'side', k => {
      if (k === 'drv') { view.driver = car; view.follow = null; view.goal = null; } else { view.driver = null; view.follow = follow; view.goal = { ...cams[k], target: null }; } });
    C.onDispose(() => eng?.stop());
    C.onFrame(dt => {
      if (view.driver) noseEye(car);
      W.followSun(view.target.x, view.target.z);
      if (!st || st.done) return; const d = dt * (slow ? 0.3 : 1); st.t += d;
      if (st.phase === 'cruise' && st.front <= P0) { st.phase = 'react'; warn.visible = true; sfx.beep(); }
      if (st.phase === 'react' && st.front <= P0 - st.dr) { st.phase = 'brake'; W.setBrake(car, true); sfx.brake(); }
      if (st.phase === 'brake') st.cur = Math.max(0, st.cur - st.a * d);
      st.front -= st.cur * d; car.position.z = st.front + HALF; eng?.set(st.cur / 30);
      if (st.phase === 'brake' && st.cur <= 0.01) { st.done = true; eng?.stop(); eng = null; setTimeout(() => { warn.visible = false; W.setBrake(car, false); }, 900); }
    });
    ctl.append(speedSel, h('div', { class: 'row tight' }, goB, slowB), camSel);
    say(info);
  });
}
