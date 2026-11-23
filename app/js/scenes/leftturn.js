// Turning left: where from and where to (textbook p.48). Same four steps and texts as the 2D flow in viz.js; each step builds the junction it is about
// (one-way / two-way roads, lane counts) and drives the car along the described path.
import { THREE, fig3, chipGroup, btn, sfx, Path, place, ease, reduced, VEHICLES } from '../kit3d.js';
import { h } from '../ui.js';
import { junction } from './_junction.js';

const TB = 'לפי ספר הלימוד הרשמי "נוהגים אחרת – נוהגים נכון" (הרשות הלאומית לבטיחות בדרכים ומשרד התחבורה)';
const STEPS = [   // [chip label, caption] – identical to the 2D flow
  ['מחד־סטרי', 'יוצאים מכביש חד־סטרי מצד שמאל של הכביש.'],
  ['מדו־סטרי', 'יוצאים מכביש דו־סטרי קרוב ככל האפשר לאמצע הכביש; אם יש שני נתיבים או יותר – מהנתיב השמאלי ביותר בכיוון הנסיעה.'],
  ['לחד־סטרי', 'נכנסים לכביש חד־סטרי לנתיב השמאלי ביותר.'],
  ['לדו־סטרי', 'נכנסים לכביש דו־סטרי עם נתיב אחד בכל כיוון בקשת רחבה לצדו הימני; אם יש שני נתיבים או יותר בכיוון – לנתיב השמאלי ביותר. סימון בכביש גובר על כל אלה.'],
];

export default function leftturn3d() {
  return fig3('פנייה שמאלה: מאיפה ולאן', TB + ', עמ׳ 48', ({ C, W, ctl, say }) => {
    const { view } = C, scene = C.scene;
    W.env({ ground: 'grass', size: 200, shadowSize: 55 }); view.min = 10; view.max = 80;
    // what each step shows: the roads, the lane the car uses, the path, and the lanes to highlight
    const CFG = [
      { v: { one: true, n: 2 }, hz: { one: false, n: 1 }, from: J => J.lane.v('nb', 0), turn: (xs, ze) => [[xs, 3.0], [xs, ze], [xs - 3.0, ze]], to: J => J.lane.h('wb', 0) },
      { v: { one: false, n: 2 }, hz: { one: false, n: 1 }, from: J => J.lane.v('nb', 0), turn: (xs, ze) => [[xs, 4.5], [xs, ze], [-4.5, ze]], to: J => J.lane.h('wb', 0) },
      { v: { one: false, n: 1 }, hz: { one: true, n: 2 }, from: J => J.lane.v('nb', 0), turn: (xs, ze) => [[xs, 5.4], [xs, ze], [-1.5, ze]], to: J => J.lane.h('wb', 0) },
      { v: { one: false, n: 1 }, hz: { one: false, n: 1 }, from: J => J.lane.v('nb', 0), turn: (xs, ze) => [[xs, 6.0], [xs, ze], [-6.0, ze]], to: J => J.lane.h('wb', 0) },
    ];
    const me = W.vehicle('hatch', { name: 'me' }); scene.add(me); W.label(me, 'אתה', { size: 1.4, bg: 'rgba(42,111,219,.95)' });
    let J = null, extras = [], path = null, i = 0, anim = null, eng = null, bl = null, quiet = 0;
    const rm = o => { scene.remove(o); o.traverse(m => { if (m.userData?.shared) return; m.geometry?.dispose?.(); for (const x of [].concat(m.material || [])) { x.map?.dispose?.(); x.dispose?.(); } }); };
    const build = () => {
      J?.dispose(); extras.forEach(rm); const cfg = CFG[i]; J = junction(C, W, { v: cfg.v, hz: cfg.hz, L: 90 }); const b = scene.children.length;
      const xs = cfg.from(J), ze = cfg.to(J), [a, c, e] = cfg.turn(xs, ze);
      path = new Path([{ t: 'l', a: [xs, 24], b: a }, { t: 'q', a, c, b: e }, { t: 'l', a: e, b: [-26, ze] }]);
      // painted arrows on one-way roads, and the lanes the step is about
      if (cfg.v.one) for (let k = 0; k < cfg.v.n; k++) for (const z of [14, 32]) W.arrow(J.lane.v('nb', k), z, { heading: 0 });
      if (cfg.hz.one) for (let k = 0; k < cfg.hz.n; k++) for (const x of [-14, -32]) W.arrow(x, J.lane.h('wb', k), { heading: Math.PI / 2 });
      W.zone(xs, 17, 3.4, 22, 0x2ecc71, { opacity: 0.45, y: 0.05 });                                            // the lane the car leaves from
      W.zone(-J.hv - 14.5, ze, 24, 3.4, 0x2a8cff, { opacity: 0.45, y: 0.05 });                                     // the lane it enters
      const pts = []; for (let s = 0; s <= path.len; s += 0.5) { const p = path.at(s); pts.push(new THREE.Vector3(p.x, 0.13, p.z)); }
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.14, 6, false), new THREE.MeshBasicMaterial({ color: 0xf5b301, transparent: true, opacity: 0.9 })));
      extras = scene.children.slice(b);
    };
    const setBlinker = on => { W.setBlinker(me, on ? 'L' : null); if (on && !bl) bl = sfx.blinker(); else if (!on && bl) { bl.stop(); bl = null; } };
    const show = () => {
      build(); chips.forEach((c, j) => c.setAttribute('aria-pressed', String(j === i)));
      say(`שלב ${i + 1} מתוך ${STEPS.length}: ${STEPS[i][1]}`);
      nextB.disabled = i >= STEPS.length - 1; if (nextB.disabled && document.activeElement === nextB) againB.focus();
      drive();
    };
    const drive = () => { place(me, path.at(0)); if (reduced()) { place(me, path.at(path.len)); anim = null; setBlinker(false); return; } anim = { t: 0, dur: 7 }; setBlinker(true); };
    C.onDispose(() => { bl?.stop(); eng?.stop(); J?.dispose(); });
    C.onFrame((dt, now) => {
      W.blinkTick(me, now); W.followSun(0, 0);
      if (anim) { anim.t = Math.min(1, anim.t + dt / anim.dur); const k = ease(anim.t); place(me, path.at(k * path.len));
        if (anim.t < 1) { quiet = 0; if (!eng) eng = sfx.engine(); eng.set(0.3); } else { anim = null; setBlinker(false); } }
      else if (eng && (quiet += dt) > 0.4) { eng.stop(); eng = null; }
    });
    const T = new THREE.Vector3(-4, 0, 2), cams = { three: { yaw: 0.35, pitch: 0.62, dist: 40 }, top: { yaw: 0, pitch: 1.45, dist: 44 } };
    Object.assign(view, cams.three); view.target.copy(T);
    const camSel = chipGroup([['three', 'מבט חצי'], ['top', 'מלמעלה'], ['drv', 'מבט הנהג']], 'three', k => {
      if (k === 'drv') { view.driver = me; view.goal = null; } else { view.driver = null; view.goal = { ...cams[k], target: T.clone() }; } });
    const chips = STEPS.map(([l], j) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(j === 0), onclick: () => { sfx.click(); i = j; show(); }, text: l }));
    const nextB = btn('השלב הבא', () => { sfx.click(); i++; show(); }, 'btn small primary'), againB = btn('מההתחלה', () => { sfx.click(); i = 0; show(); }), replayB = btn('שחזר את הנסיעה', () => { sfx.click(); drive(); });
    ctl.append(h('div', { class: 'row tight' }, chips), h('div', { class: 'row tight' }, nextB, againB, replayB), camSel);
    show();
  });
}
