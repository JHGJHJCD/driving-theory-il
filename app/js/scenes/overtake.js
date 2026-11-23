// Overtaking and the centre line (TR 47(ד), 47(ה)(5)) – real two-lane road, same variants and captions as the 2D/earlier 3D versions.
import { THREE, fig3, chipGroup, btn, label, Path, place, slowTo, sfx, reduced, LANE } from '../kit3d.js';
import { h } from '../ui.js';

export default function overtake3d() {
  return fig3('מותר לעקוף כאן?', 'לפי תקנה 47(ד) ו־47(ה)(5)', ({ C, W, ctl, say }) => {
    const { scene, view } = C, L = 200, LW = 2 * LANE;
    W.env({ ground: 'grass', size: 200, shadowSize: 55 });
    W.roadZ({ z0: -L / 2, z1: L / 2, centre: 'none', kerbs: false });
    W.trees([[-9, -60], [9.5, -40], [-10, -10], [10, 20], [-9.5, 45], [9, 70], [-12, -85], [12, 90], [-11, 30], [11, -70]]);
    // the centre-line variants: [x offset, dashed?]; x>0 is the side of the overtaking driver's own lane (right)
    const M = {
      dash: ['קו קטעים', 'קו קטעים באמצע: מותר לעקוף משמאל אם הדרך פנויה מספיק כדי לסיים בבטחה.', true, [[0, 1]]],
      solid: ['קו רצוף', 'קו הפרדה רצוף: אסור לחצות אותו – אין עקיפה.', false, [[0, 0]]],
      mineDash: ['קטעים בצד שלך', 'קו רצוף ולידו, בצד שלך (מימינו), קו קטעים: מותר לחצות, אם הדרך פנויה.', true, [[-0.17, 0], [0.17, 1]]],
      theirDash: ['רצוף בצד שלך', 'קו רצוף בצד שלך וקו הקטעים בצד הנגדי: אסור לך לחצות.', false, [[-0.17, 1], [0.17, 0]]],
    };
    let lineMeshes = [];
    const drop = arr => { for (const m of arr) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } };
    const stripe = (x, dashed) => { if (!dashed) lineMeshes.push(W.line(x, -L / 2, L / 2, { w: 0.16, y: 0.035 })); else lineMeshes.push(...W.dashes(x, -L / 2, L / 2, { w: 0.16, y: 0.035 })); };

    const me = W.vehicle('ev', { name: 'me' }), slow = W.vehicle('delivery', { name: 'slow' }); scene.add(me, slow); slow.position.set(LANE, 0, -18);
    W.label(me, 'אתה', { size: 1.3, bg: 'rgba(42,111,219,.95)' }); W.label(slow, 'רכב איטי', { size: 1.2, bg: 'rgba(80,86,96,.95)' });
    const route = new Path([{ t: 'l', a: [LANE, 16], b: [LANE, -3] }, { t: 'q', a: [LANE, -3], c: [LANE, -8], b: [-LANE, -11] }, { t: 'l', a: [-LANE, -11], b: [-LANE, -26] }, { t: 'q', a: [-LANE, -26], c: [-LANE, -30], b: [LANE, -33] }, { t: 'l', a: [LANE, -33], b: [LANE, -52] }]);
    let ribbon = null, mark = null;
    let key = 'dash', anim = null, eng = null; const cur = { s: 0 };
    place(me, route.at(0));
    const draw = k => { key = k; drop(lineMeshes); lineMeshes = []; M[k][3].forEach(([x, d]) => stripe(x, !!d)); const ok = M[k][2];
      if (ribbon) { scene.remove(ribbon); ribbon.geometry.dispose(); ribbon.material.dispose(); }
      const pts = []; for (let s = 0; s <= route.len; s += 1) { const p = route.at(s); pts.push(new THREE.Vector3(p.x, 0.12, p.z)); }
      ribbon = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.16, 6, false), new THREE.MeshBasicMaterial({ color: ok ? 0x2ecc71 : 0xe5483f, transparent: true, opacity: 0.85 })); scene.add(ribbon);
      if (mark) { scene.remove(mark); mark.material.map?.dispose(); mark.material.dispose(); }
      mark = label(ok ? '✓' : '✕', { size: 3, bg: ok ? 'rgba(30,140,80,.95)' : 'rgba(200,40,40,.95)' }); mark.position.set(0, 7, -12); scene.add(mark);
      cur.s = 0; anim = null; place(me, route.at(0)); W.setBlinker(me, null); W.setBrake(me, false); say(`אתה נוסע ימינה בנתיב הימני, מאחורי רכב איטי. ${M[k][1]}`); };
    const go = () => { sfx.click(); cur.s = 0; place(me, route.at(0)); const ok = M[key][2]; anim = { ok, target: ok ? route.len : 13, back: false, wait: 0 }; W.setBlinker(me, ok ? 'L' : null); eng ||= sfx.engine(); };
    C.onDispose(() => eng?.stop());
    C.onFrame((dt, now) => {
      W.blinkTick(me, now); if (mark) mark.position.y = 7 + Math.sin(now * 2) * 0.25;
      if (!anim) { if (eng) { eng.stop(); eng = null; } return; }
      const sp = reduced() ? 999 : 9;
      if (!anim.back) { cur.s = slowTo(cur.s, anim.target, sp, dt); eng?.set(0.5); if (cur.s >= anim.target) { if (anim.ok) { anim = null; W.setBlinker(me, null); } else { anim.back = true; sfx.horn(); anim.wait = 0.6; } } }
      else { if ((anim.wait -= dt) > 0) W.setBrake(me, true); else { W.setBrake(me, false); cur.s = slowTo(cur.s, 0, sp, dt); if (cur.s <= 0) anim = null; } }
      place(me, route.at(cur.s));
    });
    const T = () => new THREE.Vector3(0, 0, -12), cams = { three: { yaw: 0.8, pitch: 0.5, dist: 52 }, top: { yaw: 0, pitch: 1.45, dist: 48 }, back: { yaw: 0.05, pitch: 0.28, dist: 22 } };
    Object.assign(view, cams.three); view.target.copy(T()); view.max = 120; view.dist = 52;
    const sel = chipGroup(Object.keys(M).map(k => [k, M[k][0]]), 'dash', draw), goB = btn('נסה לעקוף', go, 'btn small primary');
    const camSel = chipGroup([['three', 'מבט חצי'], ['top', 'מלמעלה'], ['back', 'מאחורי הרכב'], ['drv', 'מבט הנהג']], 'three', k => { if (k === 'drv') { view.driver = me; view.goal = null; } else { view.driver = null; view.goal = { ...cams[k], target: T() }; } });
    ctl.append(sel, h('div', { class: 'row tight' }, goB), camSel); draw('dash');
  });
}
