// How big may a vehicle be? (TR 313(א)–(ב)) – the legal limits drawn as translucent boxes around real vehicle models.
// Numbers and captions copied from the 2D diagram in viz.js (dims()). The models are scaled to approximate real sizes; the boxes are the legal maxima.
import { THREE, fig3, chipGroup, label } from '../kit3d.js';

const LEN = [['גרור', 12, '313(א)(3)(ה)'], ['רכב מסחרי', 12, '313(א)(3)(א)'], ['אוטובוס 2 סרנים', 13.5, '313(א)(3)(ב)'], ['אוטובוס 3+ סרנים', 15, '313(א)(3)(ב1)'],
  ['מורכב, תא מעל המנוע', 16.5, '313(א)(3)(ד)(1)'], ['מורכב, תא מאחורי המנוע', 17.6, '313(א)(3)(ד)(2)'], ['רכב מחובר', 18.75, '313(א)(3)(ו)'], ['אוטובוס מפרקי', 18.75, '313(א)(3)(ג)']];
const f2 = m => m.toFixed(2);
const CAP = {
  len: 'אורך כולל מרבי: גרור ורכב מסחרי – 12.00 מטר; אוטובוס בעל שני סרנים – 13.50, יותר משני סרנים – 15.00; רכב מורכב (תומך ונתמך) עם תא נהג מעל המנוע – 16.50, מאחורי המנוע – 17.60; רכב מחובר (רכב מנועי וגרור) ואוטובוס מפרקי – 18.75 (313(א)(3)).',
  wh: 'רוחב כולל מרבי 2.55 מטר; 2.60 רק לגרור O1/O2 שנרשם כגרור לינה למגורים או כגרור להובלת סוסים, ולרכב עם מרכב קירור מבוקר להובלת מזון (313(א)(1)). גובה כולל מרבי לפי המשקל הכולל המותר: עד 1,500 ק"ג – 2.50; עד 3,500 – 3.00; מעל 3,500 ק"ג ובאוטובוס – 4.00 (313(א)(2)).',
  oh: 'שלוחה אחורית היא המרחק מהסרן האחורי עד הנקודה האחורית ביותר של הרכב. היא לא תעלה על 60% מרוחק הסרנים; ברכב אשפה בדחס – 63%; באוטובוס – 70%, ולא יותר מ־3.60 מטר (313(ב)).' };

export default function dims3d() {
  return fig3('כמה גדול מותר?', 'לפי תקנה 313(א) ו־(ב)', ({ C, W, ctl, say }) => {
    const { view, scene } = C;
    W.env({ ground: 'plain', size: 140, shadowSize: 40 }); W.asphalt(0, 0, 400, 400);
    const ghost = (w, hh, d, color, op = 0.3) => { const g = new THREE.Group(); const geo = new THREE.BoxGeometry(w, hh, d); g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, transparent: true, opacity: op, depthWrite: false, roughness: .6, emissive: color, emissiveIntensity: 0.25 })));
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color }))); return g; };
    const tag = (t, x, y, z, parent, bg, size = 0.8) => { const l = label(t, { size, bg: bg || 'rgba(18,28,48,.88)' }); l.position.set(x, y, z); parent.add(l); return l; };
    const G = { len: new THREE.Group(), wh: new THREE.Group(), oh: new THREE.Group() }; Object.values(G).forEach(g => scene.add(g));
    const veh = (k, g, x, z, ry) => { const v = W.vehicle(k); v.position.set(x, 0, z); v.rotation.y = ry; g.add(v); return v; };
    // ---- lengths: bars along X, right-aligned at x = 0 like the 2D diagram; vehicle fronts point to -X
    LEN.forEach(([name, m, sec], i) => { const z = i * 4; const b = ghost(m, 1.2, 2.55, 0x3aa0ff); b.position.set(-m / 2, 0.6, z); G.len.add(b);
      tag(name, -m / 2, 2.0, z, G.len, 'rgba(18,28,48,.88)', 0.85); tag(f2(m), -m - 1.6, 0.9, z, G.len, 'rgba(30,110,200,.95)', 0.85); });
    veh('delivery', G.len, -4.5, 4, Math.PI / 2); veh('lorry', G.len, -3.5, 4 * 1, Math.PI / 2).visible = false; veh('bus', G.len, -6.8, 8, Math.PI / 2); veh('bus', G.len, -7.8, 12, Math.PI / 2);
    // ---- width and height: front views, boxes 2.55 wide
    const cols = [['sedan', 2.5, 'עד 1,500 ק"ג', -8], ['van', 3.0, '1,500–3,500 ק"ג', 0], ['bus', 4.0, 'מעל 3,500 ק"ג ואוטובוס', 9]];
    cols.forEach(([k, hh, nm, x]) => { const v = veh(k, G.wh, x, 0, 0); const len = v.userData.dims.L; const b = ghost(2.55, hh, len, 0xf5b301, 0.22); b.position.set(x, hh / 2, 0); G.wh.add(b);
      tag('גובה ' + f2(hh), x, hh + 0.9, 0, G.wh, 'rgba(160,110,0,.95)', 0.9); tag('רוחב 2.55', x, hh * 0.45, -len / 2 - 0.6, G.wh, 'rgba(18,28,48,.88)', 0.6); tag(nm, x, 0.5, -len / 2 - 1.8, G.wh, 'rgba(18,28,48,.88)', 0.7); });
    tag('2.60 – רק גרור לינה, גרור סוסים ומרכב קירור למזון', 0, 6.4, 0, G.wh, 'rgba(18,28,48,.88)', 0.75);
    // ---- rear overhang: side views, front to -X, rear to +X
    const rows = [['sedan', 4.3, 0.31, 0.6, 'רכב – עד 60% (רכב אשפה בדחס – 63%)', '60%', -6], ['bus', 11.6, 0.28, null, 'אוטובוס – עד 70%, ולא יותר מ־3.60 מ׳', '70%', 6]];
    rows.forEach(([k, L, axle, pct, cap, lab, z]) => {
      const x0 = k === 'bus' ? 3 : 0; const v = veh(k, G.oh, x0, z, Math.PI / 2); const wb = k === 'bus' ? L * 0.61 : L * 0.62, rear = x0 + (k === 'bus' ? L * 0.28 : L * axle), front = rear - wb;
      const lim = k === 'bus' ? Math.min(0.7 * wb, 3.6) : 0.6 * wb;
      const a = ghost(wb, 0.3, 2.4, 0x3aa0ff, 0.45); a.position.set((front + rear) / 2, 0.15, z); G.oh.add(a);
      const o = ghost(lim, 0.3, 2.4, 0xe5483f, 0.55); o.position.set(rear + lim / 2, 0.15, z); G.oh.add(o);
      tag('רוחק הסרנים = 100%', (front + rear) / 2, 0.8, z + 2.3, G.oh, 'rgba(30,110,200,.95)', 0.7); tag(lab, rear + lim / 2, 0.8, z + 2.3, G.oh, 'rgba(200,40,40,.95)', 0.8); tag(cap, x0, 0.8, z - 2.9, G.oh, 'rgba(18,28,48,.88)', 0.7); });
    const CAMS = { len: { yaw: 0.35, pitch: 0.95, dist: 46, target: new THREE.Vector3(-9, 0, 12) }, wh: { yaw: 2.95, pitch: 0.2, dist: 25, target: new THREE.Vector3(0, 2, 0) }, oh: { yaw: 0.0, pitch: 1.05, dist: 27, target: new THREE.Vector3(2, 0, 0) } };
    let cur = 'len'; const run = k => { cur = k; for (const [n, g] of Object.entries(G)) g.visible = n === k; say(CAP[k]); view.driver = null; view.goal = { ...CAMS[k] }; };
    ctl.append(chipGroup([['len', 'אורך'], ['wh', 'רוחב וגובה'], ['oh', 'שלוחה אחורית']], 'len', run));
    Object.assign(view, CAMS.len); view.target.copy(CAMS.len.target); view.clampX = null; run('len'); Object.assign(view, CAMS.len); view.goal = null; view.target.copy(CAMS.len.target);
  });
}
