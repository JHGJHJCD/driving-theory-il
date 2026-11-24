// One sign, one scene (v1.27): the card shown inside a lesson step for a single sign number (viz id 'sc:<number>', see viz.js and data/fun.json).
// The sign (or road marking) stands where it belongs, an orange arrow shows what it is there for, and the car does what it asks. It plays once by itself.
// Scenes 301/302 come from the "signs on the road" scenes (signs3d.js); the others are written here. Adding a sign = one entry in CARDS.
// Every scene is a pure function of its clock t (seconds): the same code serves playing, replay, reduced motion and the first still.
import { THREE, fig3, btn, sfx, reduced, LANE, LANE_W } from '../kit3d.js';
import { h } from '../ui.js';
import { junction } from './_junction.js';
import { SIGNS, makeArrow, lerp, seg, run } from './signs3d.js';

// the junction scenes of signs3d.js, with a camera that no corner house stands in front of
const fromSigns = n => { const s = SIGNS.find(x => x.n === n); return { ...s, build(x) { return { ...s.build(x), cam: { yaw: 0.28, pitch: 0.5, dist: 36, target: new THREE.Vector3(0, 0, 3) } }; } }; };
const CARDS = {
  '302': fromSigns('302'),
  '301': fromSigns('301'),

  // 703: a green light. The car waits at red while the crossing traffic passes, then the light turns green and it goes on.
  '703': { arrow: 'אור ירוק: מותר להתקדם', build(x) {
    const { C, W, car, scene } = x, J = junction(C, W, { v: { one: false, n: 1 }, hz: { one: false, n: 1 }, L: 90, P: 4, houses: true });
    const light = W.trafficLight({ x: 5.6, z: 6.2, ry: 0, state: 'red' }); W.stopLine(LANE, J.hh + 0.9, LANE_W - 0.6);
    const cross = W.vehicle('hatch'); scene.add(cross); cross.rotation.y = Math.PI / 2;                          // drives west along the northern lane
    const R = run([[0, 12], [2.6, 12], [5.2, 0], [7.4, 0], [9.6, 10], [17, 12]], 5.2, J.hh + 1.2 + 2.35), GREEN = 7;
    return { duration: 17, hold: 8, sign: new THREE.Vector3(5.6, 4.9, 6.2), target: new THREE.Vector3(0, 1.0, -J.hh * 0.5), cam: { yaw: 0.28, pitch: 0.5, dist: 36, target: new THREE.Vector3(0, 0, 3) },   // not 0.8: a corner house stands between that camera and the stop line
      events: [[0, 'אור אדום: הרכב מתקרב לצומת, ותנועה חוצה עוברת.'], [5.2, 'הרכב עומד בקו העצירה ומחכה.'], [GREEN, 'התמרור 703: אור ירוק. מותר להתקדם ישר, ימינה, שמאלה או פרסה.'], [9.6, 'הצומת פנוי והרכב ממשיך ישר.']],
      update(t) { car.position.set(LANE, 0, R.z(t)); cross.position.set(lerp(70, -70, seg(t, 1.2, 6.2)), 0, -LANE_W / 2); light.set(t < GREEN ? 'red' : 'green');
        W.setBrake(car, R.v(t) < R.v(Math.max(0, t - 0.15)) - 0.2 && t < GREEN + 0.2); } }; } },

  // 803: a double solid white line. The car meets a slow lorry and stays behind it on its own side; it does not cross the lines.
  '803': { arrow: 'קו כפול רצוף: אסור לעבור', build(x) {
    const { C, W, car, scene } = x;
    W.roadZ({ z0: -120, z1: 120, centre: 'none' }); W.line(-0.14, -120, 120); W.line(0.14, -120, 120);
    W.street({ z0: -110, z1: 110, xLeft: -9.2, xRight: 9.2, seed: 5 });
    const truck = W.vehicle('lorry'); scene.add(truck);
    const R = run([[0, 9], [2.4, 9], [5.5, 3], [12, 3]], 0, 34);
    return { duration: 12, hold: 8, sign: new THREE.Vector3(-6.5, 3.6, 10), target: new THREE.Vector3(0, 0.3, -6), cam: { yaw: 0.85, pitch: 0.42, dist: 42, target: new THREE.Vector3(0, 0, -6) },
      events: [[0, 'התמרור 803: קו הפרדה רצוף כפול. אסור לעבור את הקווים בגוף הרכב.'], [3, 'לפנינו משאית איטית. הרכב מאט.'], [5.6, 'הרכב נשאר מאחורי המשאית, בצד הימני של הקווים.'], [10, 'הרכב לא עוקף ולא חוצה את הקווים.']],
      update(t) { car.position.set(LANE, 0, R.z(t)); truck.position.set(LANE, 0, -10 - 3 * t); W.setBrake(car, R.v(t) < R.v(Math.max(0, t - 0.15)) - 0.2 && t < 6); } }; } },
};

export default function signcard3d(o = {}) {
  const n = String(o.arg || '302'), card = CARDS[n] || CARDS['302'], num = CARDS[n] ? n : '302';
  return fig3('תמרור ' + num, 'לפי לוח התמרורים הרשמי (gov.il); התנועה בסצנה להמחשה', async ({ C, W, ctl, say }) => {
    const { scene, view } = C;
    const SG = await fetch(new URL('../../data/signs.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('signs'); return r.json(); });
    W.env({ ground: 'grass', size: 200, shadowSize: 50 });
    const car = W.vehicle('ev', { name: 'me' }); scene.add(car); W.label(car, 'אתה', { size: 1.2, bg: 'rgba(42,111,219,.95)' });
    const script = card.build({ C, W, scene, car }), arrow = makeArrow(script.sign, script.target, card.arrow); scene.add(arrow);
    view.driver = null; view.goal = { ...script.cam, target: script.cam.target.clone() }; Object.assign(view, { yaw: script.cam.yaw, pitch: script.cam.pitch, dist: script.cam.dist });
    let t = reduced() ? script.hold : 0, playing = !reduced(), evIdx = -1;
    const playB = btn('', () => { sfx.click(); if (t >= script.duration - 0.01) { t = 0; evIdx = -1; } playing = !playing; sync(); }, 'btn small primary');
    const againB = btn('מההתחלה', () => { sfx.click(); t = 0; evIdx = -1; playing = true; sync(); }, 'btn small');
    const sync = () => { playB.textContent = playing ? '⏸ השהה' : '▶ הפעל'; }; sync();
    const meaning = SG.e[num] ? SG.e[num].split(' · ')[0].split(/\.\s/)[0].trim().slice(0, 110) : '';   // the table's first phrase only (the full wording is long)
    ctl.append(h('p', { class: 'small', lang: 'he', dir: 'rtl', text: `תמרור ${num}${meaning ? ' – ' + meaning : ''}` }), h('div', { class: 'row tight' }, playB, againB));
    say(script.events[0][1]);
    C.onFrame((dt, now) => {
      if (playing) { t = Math.min(script.duration, t + dt); if (t >= script.duration) { playing = false; sync(); } }
      script.update(t); arrow.userData.pulse(now);
      let k = -1; script.events.forEach((e, i) => { if (t >= e[0]) k = i; }); if (k !== evIdx) { evIdx = k; if (k >= 0) say(script.events[k][1]); }
    });
  });
}
