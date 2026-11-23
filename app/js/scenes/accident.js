// Accident with an injured person: what to do, in order (TR 144(א)) – real models. Captions are those of the 2D flow in viz.js.
import { THREE, fig3, sfx, LANE, label } from '../kit3d.js';
import { Actors, stepper, camChips, hazard, warningTriangle, face, walkAnim } from './_flow3d.js';

const STEPS = [
  'עוצרים מיד, ולא מזיזים את הרכב – אלא כדי להגיש עזרה או באישור שוטר (144(א)(1)).',
  'מונעים נזק נוסף, מגישים עזרה ראשונה לפי ההכשרה, מזעיקים הצלה וממתינים ליד הנפגע (144(א)(2)).',
  'מוסרים שם ומען, מספר רישיון נהיגה, מספר רישום הרכב ושם בעליו (144(א)(3)).',
  'מודיעים מיד לתחנת המשטרה הקרובה (144(א)(4)).'];

export default function accident3d() {
  return fig3('תאונה עם נפגע: מה עושים, לפי הסדר', 'לפי תקנה 144(א)', ({ C, W, ctl, say }) => {
    W.env({ ground: 'grass', size: 200, shadowSize: 55 });
    W.roadZ({ z0: -120, z1: 120, centre: 'dash' });
    W.street({ z0: -110, z1: 110, xLeft: -9.2, xRight: 9.2, seed: 8 });
    const A = new Actors(C);
    const ZC = -7;                                                           // the collision
    const me = W.vehicle('sedan', { name: 'me' }), crashA = W.vehicle('suv'), crashB = W.vehicle('hatch'), amb = W.vehicle('ambulance'), pol = W.vehicle('police');
    const driver = W.person(1, { anim: 'idle' }), other = W.person(4, { anim: 'idle' }), hurt = W.person(7, { anim: 'sit' });
    C.scene.add(me, crashA, crashB, amb, pol, driver, other, hurt);
    W.label(me, 'אתה', { size: 1.3, bg: 'rgba(42,111,219,.95)' });
    crashA.position.set(LANE + 0.1, 0, ZC); crashA.rotation.y = 0.45; crashB.position.set(LANE - 1.9, 0, ZC - 4.2); crashB.rotation.y = -0.8; crashB.rotation.z = 0.02;
    hurt.position.set(LANE + 2.6, 0, ZC - 1.5); hurt.rotation.y = -1.2;
    const tri = warningTriangle(W, LANE, 20, 0, 1.8); tri.visible = false;
    for (const [x, z] of [[LANE + 1.2, ZC + 4.5], [LANE - 0.4, ZC + 6]]) W.cone(x, z);
    const aMe = A.add(me, { x: LANE, z: 55, h: 0 }), aAmb = A.add(amb, { x: -LANE, z: -112, h: Math.PI }), aPol = A.add(pol, { x: -LANE, z: -112, h: Math.PI }),
      aDrv = A.add(driver, { x: LANE - 1.6, z: 12, h: 0 }), aOth = A.add(other, { x: LANE - 2.6, z: ZC - 6.6, h: 0.6 });
    driver.visible = false;
    let step = 0, hz = false;
    C.onFrame((dt, now) => { hazard(me, now, hz); hazard(crashA, now, true); hazard(crashB, now, true); walkAnim(aDrv); walkAnim(aOth); });
    const hurtPos = { x: LANE + 2.6, z: ZC - 1.5 };
    const S = [
      () => { driver.visible = false; tri.visible = false; hz = false; A.goto([[aMe, { x: LANE, z: 11, h: 0 }], [aAmb, { z: -112 }], [aPol, { z: -112 }]], 3.2); setTimeout(() => { if (step === 0) { sfx.brake(); hz = true; } }, 2200); },
      () => { hz = true; driver.visible = true; tri.visible = true;
        const to = { x: hurtPos.x - 1.1, z: hurtPos.z + 0.6 }; const start = { x: LANE - 1.7, z: 11 };
        aDrv.p = { ...start, h: face(start, to) }; aDrv.obj.position.set(start.x, 0, start.z);
        A.goto([[aMe, { x: LANE, z: 11, h: 0 }], [aDrv, { ...to, h: face(start, to) }], [aAmb, { x: -LANE, z: -16, h: Math.PI }], [aPol, { z: -112 }]], 4.5); },
      () => { const to = { x: LANE - 2.2, z: ZC - 4.8 }; A.goto([[aDrv, { ...to, h: face(aDrv.p, to) }], [aAmb, { x: -LANE, z: -16, h: Math.PI }], [aPol, { z: -112 }]], 3.6); setTimeout(() => { if (step === 2) { aDrv.obj.rotation.y = face(to, aOth.p); aOth.obj.rotation.y = face(aOth.p, to); } }, 3800); },
      () => { A.goto([[aPol, { x: -LANE, z: -27, h: Math.PI }], [aAmb, { x: -LANE, z: -16, h: Math.PI }]], 4); },
    ];
    const st = stepper({ ctl, say, steps: STEPS, onShow: (i, instant) => { step = i; if (instant) { A.goto([[aMe, { x: LANE, z: 55, h: 0 }], [aAmb, { z: -112 }], [aPol, { z: -112 }], [aDrv, { x: LANE - 1.6, z: 12 }], [aOth, { x: LANE - 2.6, z: ZC - 6.6 }]], 0.01, true); } S[i](); } });
    const camSel = camChips({ C, target: new THREE.Vector3(1, 0, ZC + 8), three: { yaw: 0.75, pitch: 0.55, dist: 38 }, top: { yaw: 0, pitch: 1.45, dist: 38 }, driver: me });
    ctl.append(camSel); st.show(true);
  });
}
