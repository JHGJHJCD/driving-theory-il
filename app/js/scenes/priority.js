// Who goes first at a junction with no sign and no light (TR 64(א)(1), 64(א)(2)) – a real 4-way junction, real cars.
// Same scenarios, step texts and captions as the 2D diagram in viz.js (and the former legacy3d scene).
import { THREE, fig3, chipGroup, chip, btn, sfx, Path, place, ease, reduced, VEHICLES } from '../kit3d.js';
import { h } from '../ui.js';
import { noseEye, junction, waitZ } from './_junction.js';

export default function priority3d() {
  return fig3('מי עובר ראשון בצומת בלי תמרור?', 'לפי תקנה 64(א)(1) ו־64(א)(2)', ({ C, W, ctl, say }) => {
    const { view } = C;
    W.env({ ground: 'grass', size: 200, shadowSize: 55 });
    const J = junction(C, W, { v: { one: false, n: 1 }, hz: { one: false, n: 1 }, L: 90 });
    view.min = 10; view.max = 80;
    const me = W.vehicle('ev', { name: 'me' }), other = W.vehicle('evsedan', { name: 'other' }); C.scene.add(me, other);
    W.label(me, 'אתה', { size: 1.4, bg: 'rgba(42,111,219,.95)' });
    const LM = J.lane.v('nb', 0), LO = J.lane.h('wb', 0), LS = J.lane.v('sb', 0), mw = 24 - waitZ(J, VEHICLES.hatch.L), ow = 24 - waitZ(J, VEHICLES.sedan.L);
    const SC = {
      right: { label: 'רכב מגיע מימין', intro: 'אתה נוסע צפונה. רכב אחר מגיע מימינך. אין תמרור ואין רמזור.',
        me: new Path([{ t: 'l', a: [LM, 24], b: [LM, -24] }]), other: new Path([{ t: 'l', a: [24, LO], b: [-24, LO] }]), blink: null,
        steps: [[mw, ow, 'שני הרכבים ממתינים בכניסה לצומת.'], [mw, 48, 'הרכב שבא מימינך עובר ראשון.'], [48, 48, 'עכשיו הצומת פנוי ואתה ממשיך.']] },
      left: { label: 'אתה פונה שמאלה', intro: 'אתה רוצה לפנות שמאלה. רכב מגיע ממול וממשיך ישר.',
        me: new Path([{ t: 'l', a: [LM, 24], b: [LM, 2.2] }, { t: 'q', a: [LM, 2.2], c: [LM, LO], b: [-2.2, LO] }, { t: 'l', a: [-2.2, LO], b: [-24, LO] }]), other: new Path([{ t: 'l', a: [LS, -24], b: [LS, 24] }]), blink: 'L',
        steps: [[mw, 12, 'אתה בכניסה לצומת עם איתות שמאלה; הרכב ממול מתקרב.'], [mw, 48, 'הרכב שממול עובר ראשון – מי שפונה שמאלה ממתין לו.'], [24.2, 48, 'הדרך פנויה ואתה מתחיל לפנות.'], [null, 48, 'סיימת את הפנייה שמאלה.']] },
    };
    let sc = 'right', i = 0, run = null, eng = null, quiet = 0, bl = null;
    const S = () => SC[sc], pose = { me: 0, other: 0 };
    const goto = (a, b, instant) => { run = { a0: pose.me, b0: pose.other, a1: a, b1: b, t: instant || reduced() ? 1 : 0, dur: 2.4 }; };
    const setBlinker = () => { if (me.userData.blinkSide && !bl) bl = sfx.blinker(); else if (!me.userData.blinkSide && bl) { bl.stop(); bl = null; } };
    const show = first => {
      const s = S().steps[i];
      if (first) { pose.me = 0; pose.other = 0; place(me, S().me.at(0)); place(other, S().other.at(0)); }
      goto(s[0] === null ? S().me.len : s[0], s[1], false);
      W.setBlinker(me, S().blink && i <= 2 ? S().blink : null); setBlinker();
      say(`${S().intro} צעד ${i + 1} מתוך ${S().steps.length}: ${s[2]}`); nextB.disabled = i >= S().steps.length - 1; if (nextB.disabled && document.activeElement === nextB) againB.focus();
    };
    C.onDispose(() => { bl?.stop(); eng?.stop(); J.dispose(); });
    C.onFrame((dt, now) => {
      if (view.driver) noseEye(me);
      W.blinkTick(me, now); W.followSun(0, 0);
      if (run) { run.t = Math.min(1, run.t + dt / run.dur); const k = ease(run.t); pose.me = run.a0 + (run.a1 - run.a0) * k; pose.other = run.b0 + (run.b1 - run.b0) * k;
        place(me, S().me.at(pose.me)); place(other, S().other.at(pose.other));
        const v = Math.max(Math.abs(run.a1 - run.a0), Math.abs(run.b1 - run.b0)) / run.dur * Math.sin(run.t * Math.PI) * 0.5;
        if (run.t < 1) { quiet = 0; if (!eng) eng = sfx.engine(); eng.set(Math.min(1, v / 14)); } else run = null; }
      else if (eng && (quiet += dt) > 0.4) { eng.stop(); eng = null; }
    });
    const T = new THREE.Vector3(0, 0, 0), cams = { top: { yaw: 0, pitch: 1.45, dist: 46 }, three: { yaw: 0.3, pitch: 0.62, dist: 42 }, side: { yaw: -1.0, pitch: 0.32, dist: 30 } };
    const camSel = chipGroup([['three', 'מבט חצי'], ['top', 'מלמעלה'], ['side', 'מהצד'], ['drv', 'מבט הנהג']], 'three', k => {
      if (k === 'drv') { view.driver = me; view.goal = null; } else { view.driver = null; view.goal = { ...cams[k], target: T.clone() }; } });
    Object.assign(view, cams.three); view.target.copy(T);
    const scs = chipGroup(Object.keys(SC).map(k => [k, SC[k].label]), sc, k => { sc = k; i = 0; show(true); });
    const nextB = btn('הצעד הבא', () => { sfx.click(); i++; show(); }, 'btn small primary'), againB = btn('מההתחלה', () => { sfx.click(); i = 0; show(true); });
    ctl.append(scs, h('div', { class: 'row tight' }, nextB, againB), camSel);
    show(true);
  });
}
