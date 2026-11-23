// Hand signals (TR 59(ב), 60, 61): the driver's left arm out of the window. Captions copied from the 2D flow in viz.js.
import { THREE, LANE, label, reduced } from '../kit3d.js';
import { flowScene } from './_flow.js';

const STEPS = [
  ['מחוון\nתקול', 'מחוון הכיוון או אור הבלימה התקלקלו? מאותתים ביד (59(ב)).'],
  ['שמאלה', 'פנייה או סטייה שמאלה (או יציאה מימין הכביש): זרוע שמאל אופקית מחוץ לחלון (60(א)).'],
  ['ימינה', 'פנייה או סטייה ימינה: מניעים את כף היד והזרוע השמאלית במעגל, בכיוון השעון (60(ב)).'],
  ['עצירה', 'עצירה או האטה: מנענעים את הזרוע השמאלית למעלה ולמטה, כף היד כלפי מטה (60(ג)).'],
  ['מי\nשלפניך', 'הרכב שלפניך איתת? מאטים, ואם צריך עוצרים, כדי שיפנה, יסטה או יעצור בלי הפרעה (61).']];

// an arm out of the left window: pivot at the window, hand at the end (-X is the car's left)
function makeArm(car) {
  const d = car.userData.dims, pivot = new THREE.Group(); pivot.position.set(-d.W / 2 + 0.02, d.H * 0.58, d.L * 0.05);
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.17, 0.17), new THREE.MeshStandardMaterial({ color: 0x2f5f9a, roughness: .8 })); sleeve.position.x = -0.38;
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.24), new THREE.MeshStandardMaterial({ color: 0xe0a578, roughness: .8 })); hand.position.x = -0.86;
  sleeve.castShadow = hand.castShadow = true; pivot.add(sleeve, hand); pivot.visible = false; car.add(pivot); return pivot;
}

export default function hands3d() {
  return flowScene({ title: 'איתות ביד', src: 'לפי תקנות 59(ב), 60 ו־61', steps: STEPS, tagSize: 0.75,
    cams: { three: { yaw: -0.95, pitch: 0.38, dist: 11 }, top: { yaw: 0, pitch: 1.45, dist: 16 } }, target: [LANE, 1.2, 0],
    setup({ C, W, tw }) {
      W.env({ ground: 'grass', size: 200, shadowSize: 45 });
      W.roadZ({ z0: -110, z1: 110, centre: 'dash' }); W.street({ z0: -110, z1: 110, xLeft: -14, xRight: 14, seed: 41 });
      const H = W.vehicle('evsedan'), Ld = W.vehicle('ev'); C.scene.add(H, Ld);
      let armH = null, armL = null; W.whenReady(() => { armH = makeArm(H); armL = makeArm(Ld); });
      const bad = label('✕', { size: 0.7, bg: 'rgba(200,40,40,.95)' }); bad.position.set(-0.7, 1.1, 2.3); H.add(bad);
      let mode = 'none', arm = null, t0 = 0;
      const resetCars = () => { H.position.set(LANE, 0, 0); H.rotation.y = 0; Ld.position.set(LANE, 0, -16); Ld.rotation.y = 0; W.setBrake(H, false); W.setBrake(Ld, false); };
      return {
        driver: H,
        step(i, first) {
          if (first) { tw.clear(); resetCars(); }
          bad.visible = i === 0; if (armH) armH.visible = i >= 1 && i <= 3; if (armL) armL.visible = i === 4; mode = 'none';
          if (i === 0) { Ld.visible = false; W.setBlinker(H, null); return { tag: [LANE, 3.6, 0], look: [LANE, 1.0, 0.8], view: { yaw: -2.6, pitch: 0.3, dist: 8 } }; }
          Ld.visible = i === 4;
          if (i === 1) { arm = armH; mode = 'left'; return { tag: [LANE, 3.6, 0], look: [LANE, 1.0, 0], view: { yaw: -0.95, pitch: 0.35, dist: 8 } }; }
          if (i === 2) { arm = armH; mode = 'right'; t0 = 0; return { tag: [LANE, 3.6, 0] }; }
          if (i === 3) { arm = armH; mode = 'stop'; t0 = 0; return { tag: [LANE, 3.6, 0] }; }
          if (i === 4) { Ld.position.set(LANE, 0, -14); H.position.set(LANE, 0, 20); H.rotation.y = 0; arm = armL; mode = 'left'; W.setBrake(Ld, true);
            tw.move(H, { z: -2 }, 4.2, { e: k => 1 - (1 - k) * (1 - k) }); tw.add(0.1, () => {}, { start: () => W.setBrake(H, true) });
            tw.move(Ld, { x: -LANE, z: -20, ry: 0.18 }, 3.2, { delay: 0.8 }); return { tag: [LANE, 3.6, 0], look: [0, 1.0, -8], view: { yaw: -0.8, pitch: 0.4, dist: 18 } }; }
        },
        frame(dt, now) {
          if (!arm || !arm.visible) return; t0 += dt;
          if (mode === 'left') { arm.rotation.set(0, 0, 0); }
          else if (mode === 'right') { const a = t0 * 5; arm.rotation.set(0, Math.sin(a) * 0.5, Math.cos(a) * 0.5); }
          else if (mode === 'stop') { arm.rotation.set(0, 0, Math.sin(t0 * 6) * 0.55); }
        },
      };
    } });
}
