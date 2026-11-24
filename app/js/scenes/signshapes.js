// The sign families board in 3D (v1.26.13): four signs on poles, turning slowly, each with its real shape – a warning triangle, a round prohibition,
// "stop" (octagon) and "give way" (inverted triangle) – so the shapes are seen, not just drawn. The faces come from the toolkit's Israeli-style sign drawings.
// A pure function of the clock, like the other scenes.
import { THREE, fig3, label, reduced } from '../kit3d.js';

const SIGNS = [
  { kind: 'warnPed', name: 'אזהרה', x: -4.5 },
  { kind: 'nopass', name: 'הוריה או איסור', x: -1.5 },
  { kind: 'stop', name: 'עצור', x: 1.5 },
  { kind: 'yield', name: 'תן זכות קדימה', x: 4.5 }];

export default function signshapes3d() {
  return fig3('התמרורים בתלת-ממד', 'צורות התמרורים לפי לוח התמרורים (gov.il) ושאלות 606, 477, 310, 1772 ו־691 במאגר; הציור להמחשה', ({ C, W, say }) => {
    const { scene, view } = C;
    W.env({ ground: 'grass', size: 120, shadowSize: 30 });
    const pivots = SIGNS.map(s => {
      const g = W.sign(s.kind, { x: s.x, z: 0, h: 3.0, size: 2.3 });
      const tag = label(s.name, { size: 0.5 }); tag.position.set(s.x, 5.0, 0); scene.add(tag);
      return g;
    });
    view.driver = null; const cam = { yaw: 0, pitch: 0.12, dist: 15, target: new THREE.Vector3(0, 2.7, 0) };
    view.goal = { ...cam, target: cam.target.clone() }; Object.assign(view, { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist });
    say('ארבעה תמרורים עם הצורה שלהם: משולש אזהרה, עיגול של הוריה או איסור, מתומן ל"עצור" ומשולש הפוך ל"תן זכות קדימה". אפשר לסובב את התצוגה בעכבר.');
    C.onFrame((dt, now) => { pivots.forEach((g, i) => { g.rotation.y = reduced() ? 0.25 * (i % 2 ? -1 : 1) : Math.sin(now * 0.7 + i * 1.3) * 0.55; }); });
  });
}
