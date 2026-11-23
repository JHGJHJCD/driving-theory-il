// Before you start: driver, vehicle, passengers (TR 25, 26, 27, 79–82; TO 10) – walk-around at the kerb. Captions copied from the 2D flow in viz.js.
import { THREE, LANE } from '../kit3d.js';
import { flowScene } from './_flow.js';

const STEPS = [
  ['נהג\nכשיר', 'הנהג כשיר: לא בהשפעת אלכוהול או סמים, לא עייף עד סכנה, ובמצב גופני ונפשי שמאפשר נהיגה בטוחה (תקנה 26).'],
  ['רישיון\nמתאים', 'רישיון נהיגה תקף לסוג הרכב, ונוהגים לפי התנאים שבו – למשל משקפיים (פקודת התעבורה 10, תקנה 30).'],
  ['בקיא\nברכב', 'מכירים את הרכב ויודעים להפעיל אותו (תקנה 25).'],
  ['רכב\nתקין', 'הרכב תקין ובשליטה מלאה (27(א), (ג)); המנוע נקי ותקין – בלי עשן מעל הרגיל ובלי דליפת שמן (316), ולא נוהגים ברכב שציודו ואביזריו אינם לפי התקנות (27(ב)).'],
  ['נוסעים\nבפנים', 'כל הגוף של הנוסעים בתוך הרכב והדלתות סגורות; ליד הנהג – אדם אחד לכל היותר (תקנות 79, 82(א)).'],
  ['עלייה\nוירידה', 'עולים ויורדים רק כשהרכב עומד, מהצד הימני; פותחים דלת רק אחרי שבודקים שאין סכנה (תקנות 80, 81).']];

export default function duty3d() {
  return flowScene({ title: 'לפני שמתניעים: נהג, רכב, נוסעים', src: 'לפי תקנות 25, 26, 27, 79–82 ופקודת התעבורה 10', steps: STEPS,
    cams: { three: { yaw: 1.0, pitch: 0.42, dist: 13 }, top: { yaw: 0, pitch: 1.45, dist: 16 } }, target: [3.5, 0.8, 0],
    setup({ C, W, tw }) {
      W.env({ ground: 'grass', size: 200, shadowSize: 45 });
      W.roadZ({ z0: -110, z1: 110, centre: 'dash' }); W.street({ z0: -110, z1: 110, xLeft: -14, xRight: 14, seed: 8 });
      const car = W.vehicle('sedan'), KX = 2.45, PV = 5.6, PY = 0.16; car.position.set(KX, 0, 0); C.scene.add(car);
      const mk = (i, x, z, ry) => { const p = W.person(i, { anim: 'idle' }); p.position.set(x, PY, z); p.rotation.y = ry; C.scene.add(p); return p; };
      const driver = mk(1, PV, -2.6, -Math.PI / 2), p1 = mk(6, PV + 0.6, 2.6, -Math.PI / 2), p2 = mk(3, PV + 1.4, 3.4, -Math.PI / 2), p3 = mk(8, 3.55, 0.9, -Math.PI / 2);
      p3.position.y = 0.0;
      // licence card, floats above the driver
      const card = new THREE.Group(); const cb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.03), new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: .6 })); const cs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.035), new THREE.MeshStandardMaterial({ color: 0x1a5fb4 })); cs.position.y = 0.12;
      const cp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.17, 0.035), new THREE.MeshStandardMaterial({ color: 0xc9a27a })); cp.position.set(-0.15, -0.04, 0); card.add(cb, cs, cp); card.position.set(PV - 0.45, 1.5, -2.6); card.rotation.y = -Math.PI / 2; card.visible = false; C.scene.add(card);
      const check = new THREE.Group(); // little green tick pad under the car for the "sound vehicle" step
      C.onFrame((dt, now) => { if (card.visible) card.rotation.y = -Math.PI / 2 + Math.sin(now * 2) * 0.35; });
      const all = [driver, p1, p2, p3];
      return {
        step(i, first) {
          if (first) { tw.clear(); driver.position.set(PV, PY, -2.6); driver.rotation.y = -Math.PI / 2; driver.visible = true; p1.position.set(PV + 0.6, PY, 2.6); p2.position.set(PV + 1.4, PY, 3.4); p1.visible = p2.visible = true; p3.visible = false; p3.position.set(3.55, 0, 0.9); card.visible = false; all.forEach(p => p.userData.play('idle')); }
          if (i === 0) { driver.userData.play('emote-yes'); return { tag: [PV, 2.9, -2.6], look: [3.8, 0.8, -1] }; }
          if (i === 1) { driver.userData.play('idle'); card.visible = true; return { tag: [PV, 2.9, -2.6] }; }
          card.visible = false;
          if (i === 2) { tw.walk(driver, 3.7, -1.4, { ry2: -Math.PI / 2, end: () => driver.userData.play('interact-right') }); return { tag: [3.7, 2.9, -1.4], look: [3.2, 0.8, -1] }; }
          if (i === 3) { tw.walk(driver, 3.7, -2.6, { ry2: -Math.PI / 2, end: () => driver.userData.play('crouch') }); return { tag: [3.7, 2.5, -2.6], look: [3.2, 0.8, -1.5] }; }
          if (i === 4) { driver.userData.play('idle'); driver.position.set(PV, PY, -2.6); tw.walk(p1, 3.9, 0.9, { end: () => { p1.visible = false; } }); tw.walk(p2, 3.9, 1.4, { delay: 0.8, end: () => { p2.visible = false; } }); return { tag: [3.4, 3.1, 0.9], look: [3.4, 0.8, 0.6] }; }
          if (i === 5) { p3.visible = true; p3.position.set(3.55, 0, 0.9); p3.userData.play('idle'); tw.walk(p3, PV + 0.4, 1.6, { delay: 0.6, ry2: Math.PI / 2 }); return { tag: [3.4, 3.1, 0.9], look: [3.6, 0.8, 0.8] }; }
        },
      };
    } });
}
