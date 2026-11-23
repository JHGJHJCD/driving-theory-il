// The hidden pedestrian (TR 67(א2), 67(א)) – real models, real crossing. Same facts and captions as the 2D diagram in viz.js.
import { THREE, fig3, chipGroup, btn, sfx, place, slowTo, reduced, LANE } from '../kit3d.js';
import { h } from '../ui.js';

export default function crosswalk3d() {
  return fig3('הרכב בנתיב השני עצר לפני המעבר', 'לפי תקנה 67(א2) ו־67(א)', ({ C, W, ctl, say }) => {
    const { view } = C, ZB = -8, STOP = -2.9;
    W.env({ ground: 'grass', size: 200, shadowSize: 45 });
    W.roadZ({ z0: -110, z1: 110, centre: 'dash' }); W.zebra(0, ZB, LANE * 4 - 0.8, { depth: 3.2, bar: 0.5, gap: 0.5 });
    W.stopLine(LANE, STOP + 3.4, LANE * 2 - 0.6); W.stopLine(-LANE, STOP + 3.4, LANE * 2 - 0.6);
    W.sign('crossing', { x: 7.4, z: ZB + 3.2, ry: -Math.PI / 2 + 0.25 }); W.sign('crossing', { x: -7.4, z: ZB - 3.2, ry: Math.PI / 2 + 0.25 });
    W.street({ z0: -110, z1: 90, xLeft: -9.2, xRight: 9.2, seed: 5 });
    const me = W.vehicle('hatch', { name: 'me' }), other = W.vehicle('suv', { name: 'other' }), ped = W.person(1, { anim: 'idle' });
    C.scene.add(me, other, ped); W.label(me, 'אתה', { size: 1.3, bg: 'rgba(42,111,219,.95)' });
    const car = (x, z) => ({ x, z }), ST = [[car(LANE, 22), car(-LANE, 12), -6.2, 'אתה בנתיב הימני. הרכב בנתיב השמאלי מאט לקראת מעבר החצייה.'],
      [car(LANE, 8), car(-LANE, STOP), -6.2, 'הרכב בנתיב השמאלי עצר לפני המעבר. ייתכן שהוא מסתיר הולך רגל – לכן גם אתה מאט ועוצר.'],
      [car(LANE, STOP), car(-LANE, STOP), 1.8, 'אתה עומד לפני המעבר. הולך רגל יוצא מאחורי הרכב שעצר וחוצה.'],
      [car(LANE, STOP), car(-LANE, STOP), 6.2, 'הולך הרגל סיים לחצות בבטחה. רק עכשיו ממשיכים.']];
    let i = 0, tgt = null, eng = null, quiet = 0; const cur = { mz: 38, oz: 28, px: -6.2 };
    place(me, { x: LANE, z: cur.mz, h: 0 }); place(other, { x: -LANE, z: cur.oz, h: 0 }); ped.position.set(cur.px, 0, ZB);
    const show = () => { const s = ST[i]; tgt = { mz: s[0].z, oz: s[1].z, px: s[2] }; say(`צעד ${i + 1} מתוך ${ST.length}: ${s[3]}`); nextB.disabled = i >= ST.length - 1; if (nextB.disabled && document.activeElement === nextB) againB.focus(); if (i === 1) setTimeout(sfx.brake, 700); if (i === 2) setTimeout(sfx.beep, 600); };
    C.onDispose(() => eng?.stop());
    C.onFrame((dt, now) => {
      if (!tgt) return; const sp = reduced() ? 999 : 1;
      const mz = slowTo(cur.mz, tgt.mz, 12 * sp, dt), oz = slowTo(cur.oz, tgt.oz, 12 * sp, dt), px = slowTo(cur.px, tgt.px, 1.6 * sp, dt);
      const moving = mz !== cur.mz || oz !== cur.oz, pm = px !== cur.px; cur.mz = mz; cur.oz = oz; cur.px = px;
      place(me, { x: LANE, z: mz, h: 0 }); place(other, { x: -LANE, z: oz, h: 0 }); ped.position.set(px, 0, ZB);
      if (pm) ped.rotation.y = tgt.px > px ? Math.PI / 2 : -Math.PI / 2; ped.userData.play(pm ? 'walk' : 'idle');
      W.setBrake(me, moving && mz > STOP && i >= 1);
      if (moving) { quiet = 0; if (!eng) eng = sfx.engine(); eng.set(0.35); } else if (eng && (quiet += dt) > 0.4) { eng.stop(); eng = null; }
    });
    const T = new THREE.Vector3(0, 0, ZB + 4), cams = { three: { yaw: 0.9, pitch: 0.5, dist: 26 }, top: { yaw: 0, pitch: 1.45, dist: 34 } };
    view.target.copy(T); Object.assign(view, { yaw: 0.9, pitch: 0.5, dist: 26 });
    const camSel = chipGroup([['three', 'מבט חצי'], ['top', 'מלמעלה'], ['drv', 'מבט הנהג']], 'three', k => { if (k === 'drv') { view.driver = me; view.goal = null; } else { view.driver = null; view.goal = { ...cams[k], target: T.clone() }; } });
    const nextB = btn('הצעד הבא', () => { sfx.click(); i++; show(); }, 'btn small primary'), againB = btn('מההתחלה', () => { sfx.click(); i = 0; cur.mz = 38; cur.oz = 28; cur.px = -6.2; show(); });
    ctl.append(h('div', { class: 'row tight' }, nextB, againB), camSel); show();
  });
}
