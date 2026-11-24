// Family 1 of the sign cards (v1.27): the warning signs 101-153. Not one hand-made scene per sign: about a dozen "hazard" templates, and a table that gives each sign its template.
// Every scene shows the sign (the official picture from data/signs.json when it has one, else a numbered plate) about 28 m before the hazard, an orange arrow from the sign to the
// hazard, and the car doing what the sign asks. Pure functions of the clock t, like every scene here. Rail / crossing / pedestrian signs reuse the scenes of signs3d.js.
import { THREE, LANE, LANE_W, label } from '../kit3d.js';
import { junction } from './_junction.js';
import { lerp, seg, run } from './signs3d.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CAM = { yaw: 0.85, pitch: 0.42, dist: 44, target: V(0, 0, 6) };
const BOARD = V(5.4, 3.0, 17);

/** the sign on its pole, facing the car: the official picture cropped to its middle square, else a numbered blue plate */
function board(x, n) {
  const { W, scene, SG } = x, file = SG?.img?.[n];
  if (!file) return W.sign('info', { x: BOARD.x, z: BOARD.z, size: 2.5, text: String(n) });
  const g = new THREE.Group(); g.position.set(BOARD.x, 0, BOARD.z); scene.add(g);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.0, 8), new THREE.MeshStandardMaterial({ color: 0x8d949c, metalness: 0.5, roughness: 0.4 })); pole.position.y = 1.5; g.add(pole);
  const tex = new THREE.TextureLoader().load(new URL('../../img/q/' + file, import.meta.url).href); tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(0.5625, 1); tex.offset.set(0.21875, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, side: THREE.DoubleSide })); face.position.set(0, 3.1, 0.05); g.add(face);
  face.castShadow = true; pole.castShadow = true; return g;
}

/** straight road + sign + the car's speed profile; o: { z (hazard), v: speed keys, tAlign/zAlign, events, update(t, R), cam, target, duration, hold, centre } */
function stage(x, n, o) {
  const { W, car } = x, Z = o.z ?? -12;
  W.roadZ({ z0: -120, z1: 120, centre: o.centre ?? 'dash' }); W.street({ z0: -110, z1: 110, xLeft: -9.2, xRight: 9.2, seed: 5 }); board(x, n);
  const R = run(o.v ?? [[0, 12], [2.5, 12], [6, 5], [14, 5]], o.tAlign ?? 0, o.zAlign ?? 36), upd = o.update || (() => {});
  return { duration: o.duration ?? 9, hold: o.hold ?? 4, sign: BOARD, target: o.target ?? V(0, 1.2, Z), cam: o.cam ?? CAM, events: o.events,
    update(t) { car.position.set(LANE, 0, R.z(t)); upd(t, R); W.setBrake(car, R.v(t) < R.v(Math.max(0, t - 0.15)) - 0.2); } };
}
const STOP = [[0, 12], [2.5, 12], [6, 0], [9, 0], [11, 8], [16, 10]];   // slows, waits, goes on (tAlign 6)
const ev = (a, b, c) => [[0, 'התמרור מזהיר: ' + a + ' הרכב מתקרב.'], [2.5, b], [5.2, c]];

// ---------------------------------------------------------------- the hazard templates: kind -> (x, n) => script
const KINDS = {
  bumps: (x, n) => { const { W, car } = x; for (const z of [-6, -9, -12, -15]) W.box(LANE, 0.05, z, LANE_W - 0.3, 0.1, 0.8, 0xe8c200);
    return stage(x, n, { z: -10, events: ev('מהמורות או פסי האטה בכביש.', 'הרכב מאט לפני המקום.', 'הרכב עובר עליו לאט.'),
      update: (t, R) => { const z = R.z(t); car.position.y = z < -5 && z > -16 ? 0.07 * Math.abs(Math.sin(z * 2.2)) : 0; } }); },
  narrow: (x, n) => { const { W, car } = x; for (let i = 0; i < 6; i++) W.cone(lerp(3.5, 2.7, i / 5), -4 - i * 2.4);
    return stage(x, n, { z: -10, events: ev('הכביש הולך וצר.', 'הרכב מאט ומתקרב לשמאל הנתיב.', 'הרכב עובר במעבר הצר.'),
      update: (t, R) => { const z = R.z(t); car.position.x = LANE - 0.9 * Math.min(1, Math.max(0, (-1 - z) / 8)) * (z > -20 ? 1 : Math.max(0, 1 - (-20 - z) / 8)); } }); },
  slip: (x, n, deep) => { const { W, car } = x; W.zone(LANE, -10, LANE_W - 0.4, 15, deep ? 0x2a6fdb : 0x9fc4ff, { opacity: deep ? 0.6 : 0.45 });
    return stage(x, n, { z: -10, events: ev(deep ? 'מים עמוקים על הכביש.' : 'הכביש עלול להיות חלק.', 'הרכב מאט לפני המקום.', 'הרכב עובר לאט ובזהירות.'),
      update: (t, R) => { const z = R.z(t); car.rotation.y = z < -2 && z > -18 ? 0.07 * Math.sin(z * 0.9) : 0; } }); },
  rocks: (x, n) => { const { scene } = x, m = new THREE.MeshStandardMaterial({ color: 0x8a8780, roughness: 1 }), rocks = [[5.2, -8], [5.8, -12], [4.6, -16]].map(([px, pz]) => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5), m); r.position.set(px, 0.4, pz); r.castShadow = true; scene.add(r); return r; });
    return stage(x, n, { z: -10, events: ev('אבנים עלולות להידרדר אל הכביש.', 'הרכב מאט. אבן מידרדרת לכיוון הנתיב.', 'הרכב ממשיך לאט, בזהירות.'),
      update: t => { rocks[0].position.x = lerp(5.2, 2.4, seg(t, 2, 4.2)); rocks[0].rotation.z = -seg(t, 2, 4.2) * 6; } }); },
  queue: (x, n) => { const { W } = x, qs = ['hatch', 'suv', 'taxi'].map((k, i) => { const c = W.vehicle(k); x.scene.add(c); c.position.set(LANE, 0, -8 - i * 5.8); W.setBrake(c, true); return c; });
    return stage(x, n, { z: -10, v: [[0, 12], [2.5, 12], [6, 0], [14, 0]], tAlign: 6, zAlign: -1.5, duration: 11, hold: 6, cam: CAM,
      events: ev('גודש בתנועה לפניך.', 'הרכב מאט; לפנינו תור של רכבים.', 'הרכב עוצר בסוף התור, במרחק.') }); },
  signal: (x, n) => { const { W } = x, L = W.trafficLight({ x: 5.4, z: -12, ry: 0, state: 'red' }); W.stopLine(LANE, -9.5, LANE_W - 0.6);
    return stage(x, n, { z: -12, v: STOP, tAlign: 6, zAlign: -7.5, duration: 14, hold: 6, target: V(5.4, 4.6, -12), events: [[0, 'התמרור מזהיר: רמזור לפניך. הרכב מתקרב.'], [2.5, 'הרכב מאט: הרמזור אדום.'], [9, 'האור התחלף לירוק והרכב ממשיך.']],
      update: t => L.set(t < 9 ? 'red' : 'green') }); },
  stopAhead: (x, n) => { const { W } = x; W.sign('stop', { x: 5.6, z: -12, ry: 0, size: 1.7 }); W.stopLine(LANE, -9.5, LANE_W - 0.6);
    return stage(x, n, { z: -12, v: STOP, tAlign: 6, zAlign: -7.5, duration: 14, hold: 6, target: V(5.6, 3, -12), events: [[0, 'התמרור מזהיר: תמרור עצור בהמשך הדרך. הרכב מתקרב.'], [2.5, 'הרכב מאט.'], [6, 'הרכב עוצר לפני הצומת.'], [9.5, 'הדרך פנויה והרכב ממשיך.']] }); },
  tunnel: (x, n) => { const { W, car } = x; for (const sx of [-1, 1]) W.box(sx * 4.6, 2.6, -10, 0.9, 5.2, 22, 0x6b6e73); W.box(0, 5.4, -10, 10.2, 0.6, 22, 0x585b60);
    return stage(x, n, { z: -10, v: [[0, 12], [2.5, 12], [5, 7], [14, 7]], events: ev('מנהרה בהמשך.', 'הרכב מדליק אורות ונכנס למנהרה.', 'הרכב נוסע במנהרה.'), update: (t, R) => W.setHeadlights(car, R.z(t) < 4) }); },
  twoway: (x, n) => { const { W } = x, o = W.vehicle('taxi'); x.scene.add(o); o.rotation.y = Math.PI;
    return stage(x, n, { z: -10, v: [[0, 10], [14, 10]], events: ev('תנועה דו-סטרית.', 'רכב מגיע מהכיוון הנגדי, בצד השמאלי של הכביש.', 'הרכב נשאר בצד הימני.'), update: t => o.position.set(-LANE, 0, lerp(-50, 45, seg(t, 0.5, 6))) }); },
  junction: (x, n) => { const { C, W } = x, J = junction(C, W, { v: { one: false, n: 1 }, hz: { one: false, n: 1 }, L: 90, P: 4, houses: true }), cross = W.vehicle('hatch'); x.scene.add(cross); cross.rotation.y = Math.PI / 2; board(x, n);
    const R = run([[0, 12], [2.5, 12], [6, 5], [16, 5]], 0, 36);
    return { duration: 10, hold: 4, sign: BOARD, target: V(0, 1.0, 0), cam: { yaw: 0.28, pitch: 0.5, dist: 36, target: V(0, 0, 3) }, events: ev('צומת לפניך.', 'הרכב מאט לפני הצומת; רכב חוצה.', 'הרכב עובר את הצומת בזהירות.'),
      update(t) { x.car.position.set(LANE, 0, R.z(t)); cross.position.set(lerp(70, -70, seg(t, 1, 7)), 0, -LANE_W / 2); W.setBrake(x.car, R.v(t) < R.v(Math.max(0, t - 0.15)) - 0.2); } }; },
  work: (x, n) => { const { W } = x, tr = W.vehicle('tractor'); x.scene.add(tr); tr.rotation.y = Math.PI / 2; W.cone(5, -9); W.cone(-5, -9);
    return stage(x, n, { z: -12, v: [[0, 12], [2.5, 12], [5.5, 0], [9, 0], [12, 8], [16, 10]], tAlign: 5.5, zAlign: -4, duration: 14, hold: 6, events: ev('רכב עבודה או טרקטור חוצה את הכביש.', 'הרכב מאט.', 'הרכב עוצר ומחכה שהטרקטור יעבור.'), update: t => tr.position.set(lerp(14, -14, seg(t, 2.5, 9)), 0, -12) }); },
  height: (x, n) => { const { W, scene } = x; for (const sx of [-1, 1]) W.box(sx * 4.6, 2.5, -10, 0.4, 5, 0.4, 0x4a4f57); W.box(0, 4.8, -10, 9.6, 0.35, 0.4, 0xd62828); const l = label('4.80', { size: 1.3 }); l.position.set(0, 5.9, -10); scene.add(l);
    return stage(x, n, { z: -10, target: V(0, 4.8, -10), events: ev('מכשול גובה: מעבר מתחת ל-4.80 מטר.', 'הרכב מאט לפני המעבר.', 'הרכב עובר מתחת למכשול.') }); },
  generic: (x, n) => { const { W } = x; W.zone(LANE, -10, LANE_W - 0.4, 10, 0xffb300, { opacity: 0.4 }); W.cone(3.4, -4); W.cone(3.4, -14);
    return stage(x, n, { z: -10, events: ev('מקום שדורש זהירות.', 'הרכב מאט לפני המקום.', 'הרכב עובר בזהירות.') }); },
};
const slipDeep = (x, n) => KINDS.slip(x, n, true);

// ---------------------------------------------------------------- sign number -> [template, arrow label]
const MAP = { 101: ['bumps', 'כביש משובש: האט'], 144: ['bumps', 'פסי האטה: האט'],
  109: ['narrow', 'הכביש הולך וצר'], 110: ['narrow', 'הכביש הולך וצר'], 111: ['narrow', 'הכביש הולך וצר'], 112: ['narrow', 'מעבר צר או מכשול'], 113: ['height', 'מכשול גובה'],
  114: ['junction', 'צומת לפניך'], 115: ['junction', 'צומת לפניך'], 116: ['junction', 'צומת לפניך'], 117: ['junction', 'צומת לפניך'], 118: ['junction', 'צומת לפניך'], 119: ['junction', 'צמתים לפניך'], 120: ['junction', 'צמתים לפניך'],
  121: ['junction', 'מעגל תנועה לפניך'], 122: ['signal', 'רמזור לפניך'], 123: ['junction', 'התמזגות לפניך'], 124: ['junction', 'התמזגות לפניך'], 125: ['junction', 'התמזגות לפניך'], 126: ['junction', 'התמזגות לפניך'],
  127: ['queue', 'גודש בתנועה'], 138: ['tunnel', 'מנהרה'], 139: ['stopAhead', 'עצור לפניך'], 141: ['slip', 'סכנת החלקה'], 142: ['rocks', 'אבנים מידרדרות'], 143: ['rocks', 'אבנים מידרדרות'],
  145: ['twoway', 'תנועה דו-סטרית'], 147: ['work', 'רכב עבודה חוצה'], 153: ['slipDeep', 'מים עמוקים'] };
for (let i = 102; i <= 108; i++) MAP[i] ??= ['generic', i === 106 ? 'דרך מפותלת' : 'עקומה חדה: האט'];
for (const [i, l] of [[137, 'אופניים בקרבת מקום'], [140, 'ירידה תלולה'], [146, 'בעלי חיים'], [148, 'עמודי הכוונה'], [149, 'עמודון להכוונה'], [150, 'מקום מסוכן'], [151, 'תאונה'], [152, 'רוח צד']]) MAP[i] = ['generic', l];
const FN = { ...KINDS, slipDeep };

/** a card { arrow, build } for a warning sign 101-153 that has no scene of its own in signs3d.js, else null */
export const warnCard = n => { const m = MAP[+n]; return m ? { arrow: m[1], build: x => FN[m[0]](x, String(n)) } : null; };
export const WARN_NUMBERS = Object.keys(MAP).map(Number);
