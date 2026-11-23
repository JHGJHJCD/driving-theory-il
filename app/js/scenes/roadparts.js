// Parts of the road (TO 1 "דרך"; TR 1 "כביש", "נתיב", "שטח הפרדה", "שול הדרך") – real dual carriageway with traffic. Same facts and captions as the 2D diagram (viz.js) and the earlier 3D version.
import { THREE, fig3, chipGroup, label, LANE_W } from '../kit3d.js';

const RP = [['road', 'דרך', 'דרך – כל השטח הפתוח שיש לציבור זכות לעבור בו: הכבישים, שטח ההפרדה והשוליים (פקודת התעבורה 1).'],
  ['cw', 'כביש', 'כביש – החלק שמיועד לתנועת כלי רכב, בלי השוליים. כאן יש שני כבישים, אחד מכל צד של שטח ההפרדה (תקנה 1).'],
  ['lane', 'נתיב', 'נתיב – חלק מרוחב הכביש שמספיק לטור אחד של כלי רכב, מסומן או לא. כל כביש כאן מחולק לשני נתיבים (תקנה 1).'],
  ['sep', 'שטח הפרדה', 'שטח הפרדה – אי תנועה, גינה, סימון או שטח לא סלול שמחלקים את הדרך לאורכה (תקנה 1).'],
  ['sh', 'שול', 'שול הדרך – השטח שליד שפת הכביש כשאין לידו מדרכה, עד רוחב של 4 מטרים (תקנה 1).']];

export default function roadparts3d() {
  return fig3('חלקי הדרך – לחצו על חלק', 'לפי פקודת התעבורה 1 ותקנה 1', ({ C, W, ctl, say }) => {
    const { scene, view } = C, SH = 3, CW = 2 * LANE_W, SEP = 3, L = 220;
    const cwR = SEP / 2 + CW / 2, cwL = -cwR, shR = SEP / 2 + CW + SH / 2, shL = -shR;
    W.env({ ground: 'grass', size: 200, shadowSize: 60 });
    // shoulders (no kerb, light gravel), the two carriageways, the central reservation with kerbs and grass
    W.flat(shR, 0, SH, L, 0xb9ab8a, { y: 0.02, rough: 1 }); W.flat(shL, 0, SH, L, 0xb9ab8a, { y: 0.02, rough: 1 });
    W.asphalt(cwR, 0, CW, L); W.asphalt(cwL, 0, CW, L);
    W.box(0, 0.07, 0, SEP - 0.5, 0.14, L, 0x5f9b4a, { roughness: 1 });
    W.kerb(SEP / 2 - 0.125, 0, 0.25, L, { h: 0.14 }); W.kerb(-SEP / 2 + 0.125, 0, 0.25, L, { h: 0.14 });
    for (const cx of [cwR, cwL]) { W.line(cx - CW / 2 + 0.25, -L / 2, L / 2); W.line(cx + CW / 2 - 0.25, -L / 2, L / 2); W.dashes(cx, -L / 2, L / 2); }
    for (let z = -L / 2 + 10; z < L / 2; z += 22) W.prop('city/tree-small', { scale: 6, x: 0, z });
    W.trees([[-14, -40], [-17, 10], [-13, 55], [15, -55], [14, -5], [17, 40], [-20, -70], [19, 75]]);
    // traffic: northbound (toward -Z) on the east side, southbound on the west side
    const cars = [];
    [[cwR + LANE_W / 2, 'evsedan', -1, 0], [cwR - LANE_W / 2, 'ev', -1, 60], [cwL - LANE_W / 2, 'van', 1, 25], [cwL + LANE_W / 2, 'taxi', 1, 110]].forEach(([x, k, dir, off]) => {
      const c = W.vehicle(k); c.userData.dir = dir; c.userData.off = off; c.position.x = x; c.rotation.y = dir < 0 ? 0 : Math.PI; scene.add(c); cars.push(c); });
    C.onFrame((dt, now) => { for (const c of cars) { const z = (now * 9 + c.userData.off) % L; c.position.z = c.userData.dir < 0 ? L / 2 - z : -L / 2 + z; } });
    // highlight overlays
    let hl = [], lab = null;
    const clear = () => { for (const m of hl) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } hl = []; if (lab) { scene.remove(lab); lab.material.map?.dispose(); lab.material.dispose(); lab = null; } };
    const ov = (w, x, color = 0x2a8cff) => { const m = W.flat(x, 0, w, L, color, { y: 0.1, opacity: 0.5, emissive: color }); hl.push(m); };
    const lanesX = [cwL - LANE_W / 2, cwL + LANE_W / 2, cwR - LANE_W / 2, cwR + LANE_W / 2];
    const PARTS = { road: () => ov(SH * 2 + CW * 2 + SEP, 0), cw: () => { ov(CW, cwR); ov(CW, cwL); },
      lane: () => lanesX.forEach((x, i) => ov(LANE_W - 0.3, x, [0x2a8cff, 0xf5b301][i % 2])), sep: () => ov(SEP, 0, 0x2ecc71), sh: () => { ov(SH, shR, 0xe5483f); ov(SH, shL, 0xe5483f); } };
    const LABX = { road: 0, cw: cwR, lane: lanesX[2], sep: 0, sh: shR };
    const run = k => { clear(); PARTS[k](); const p = RP.find(r => r[0] === k); lab = label(p[1], { size: 2.2 }); lab.position.set(LABX[k], 5, 8); scene.add(lab); say(p[2]); };
    C.onFrame((dt, now) => { const o = 0.38 + 0.22 * Math.sin(now * 3); for (const m of hl) m.material.opacity = o; });
    const T = () => new THREE.Vector3(0, 0, 0), cams = { three: { yaw: 0.55, pitch: 0.5, dist: 46 }, top: { yaw: 0, pitch: 1.45, dist: 52 }, eye: { yaw: 0, pitch: 0.14, dist: 36 } };
    Object.assign(view, cams.three); view.target.set(0, 0, 0); view.max = 120;
    const sel = chipGroup(RP.map(p => [p[0], p[1]]), 'road', run), camSel = chipGroup([['three', 'מבט חצי'], ['top', 'מלמעלה'], ['eye', 'מהכביש']], 'three', k => { view.goal = { ...cams[k], target: T() }; });
    ctl.append(sel, camSel); run('road');
  });
}
