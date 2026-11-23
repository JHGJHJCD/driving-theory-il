// A motorcyclist approaches a junction – real models. Captions are those of the 2D flow in viz.js.
import { THREE, fig3, sfx, LANE, LANE_W, label } from '../kit3d.js';
import { Actors, stepper, camChips } from './_flow3d.js';

const STEPS = ['בהתקרבות לצומת וביציאה ממנו – מאטים.', 'מתמקמים בנתיב כך ששדה הראייה רחב יותר ושנהגים אחרים יכולים להבחין בכם.', 'מוודאים שהצומת פנוי.', 'מצייתים לרמזורים ולתמרורים.'];
const TAGS = [['מאטים', 'rgba(30,140,80,.95)'], ['מתמקמים בנתיב', 'rgba(30,140,80,.95)'], ['מוודאים שהצומת פנוי', 'rgba(30,140,80,.95)'], ['מצייתים לרמזור', 'rgba(200,40,40,.95)']];

export default function motojx3d() {
  return fig3('באופנוע: מתקרבים לצומת', 'לפי חוברת "כללי בטיחות בדרכים" של הרשות הלאומית לבטיחות בדרכים (מרץ 2026), עמ׳ 31', ({ C, W, ctl, say }) => {
    W.env({ ground: 'grass', size: 220, shadowSize: 60 });
    const J = LANE_W, P = 4;                                                      // half road width, pavement width
    W.roadZ({ z0: -130, z1: -J, centre: 'dash' }); W.roadZ({ z0: J, z1: 120, centre: 'dash' });
    W.roadX({ z: 0, x0: -130, x1: -J, centre: 'dash', kerbs: false }); W.roadX({ z: 0, x0: J, x1: 130, centre: 'dash', kerbs: false });
    W.asphalt(0, 0, 2 * J, 2 * J);
    for (const s of [-1, 1]) { W.kerb(-(J + P) - 60, s * (J + P / 2), 120, P); W.kerb((J + P) + 60, s * (J + P / 2), 120, P); }
    W.stopLine(LANE, J + 1.1, LANE_W - 0.6); W.zebra(0, J + 4.2, 2 * LANE_W - 1, { alongZ: false, depth: 3, bar: 0.5, gap: 0.5 });
    const tl = W.trafficLight({ x: J + 1.4, z: J + 2.0, ry: 0, state: 'green' }), tl2 = W.trafficLight({ x: J + 1.4, z: -J - 2.0, ry: Math.PI / 2, state: 'red' });
    const r = [[1, 0], [1, 1], [-1, 0], [-1, 1]]; const rnd = [20, 30, 24, 34, 28, 22];
    r.forEach(([sx, k], i) => { for (let j = 0; j < 3; j++) { const z = 16 + j * 22, sz = k ? 1 : -1; W.prop(['city/building-type-b', 'shops/building-c', 'city/building-type-e'][(i + j) % 3], { scale: 9, x: sx * (rnd[(i * 3 + j) % 6] + 4), z: sz * z, ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2 }); } });
    W.trees([[11, 12], [-11, 12], [11, -12], [-11, -12], [11, 40], [-11, -40], [11, -55], [-11, 55]]);
    C.view.clampX = 14;
    const bike = W.moto({ riderIndex: 2 }), car = W.vehicle('taxi'); C.scene.add(bike, car);
    const A = new Actors(C), a = A.add(bike, { x: LANE, z: 86, h: 0 }), c = A.add(car, { x: 55, z: -LANE, h: Math.PI / 2 });
    // what the rider can see ahead
    const fan = new THREE.Mesh(new THREE.CircleGeometry(24, 28, Math.PI / 2 - 0.55, 1.1), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    fan.rotation.x = -Math.PI / 2; fan.rotation.z = 0; fan.position.y = 0.08; fan.visible = false; bike.add(fan);
    fan.rotation.set(-Math.PI / 2, 0, 0);
    let tag = null, cur = 0;
    const setTag = i => { if (tag) { bike.remove(tag); tag.material.map?.dispose(); } tag = label(TAGS[i][0], { size: 1.2, bg: TAGS[i][1] }); tag.position.set(0, 3.4, 0); bike.add(tag); };
    C.onFrame(() => { const rot = a.moving ? 1 : 0; for (const w of bike.userData.wheels) w.rotation.x -= rot * 0.2; });
    const T = [
      () => { fan.visible = false; W.setBrake(bike, false); tl.set('green'); A.goto([[a, { x: LANE, z: 36, h: 0 }], [c, { x: 24, z: -LANE, h: Math.PI / 2 }]], 4); setTimeout(() => { if (cur === 0) W.setBrake(bike, true); }, 2600); },
      () => { fan.visible = true; fan.material.color.set(0x4ade80); W.setBrake(bike, false); tl.set('green'); A.goto([[a, { x: LANE - 0.85, z: 24, h: 0 }], [c, { x: 7, z: -LANE, h: Math.PI / 2 }]], 3.6); },
      () => { fan.visible = true; W.setBrake(bike, false); tl.set('green'); A.goto([[a, { x: LANE - 0.85, z: 15, h: 0 }], [c, { x: -45, z: -LANE, h: Math.PI / 2 }]], 4.8); },
      () => { fan.visible = false; tl.set('yellow'); setTimeout(() => { if (cur === 3) { tl.set('red'); tl2.set('green'); } }, 1400); W.setBrake(bike, true); sfx.brake(); A.goto([[a, { x: LANE - 0.4, z: J + 2.0, h: 0 }], [c, { x: -45, z: -LANE, h: Math.PI / 2 }]], 3.6); },
    ];
    const st = stepper({ ctl, say, steps: STEPS, onShow: (i, instant) => { cur = i; if (instant) { A.goto([[a, { x: LANE, z: 86 }], [c, { x: 55, z: -LANE }]], 0.01, true); tl2.set('red'); } setTag(i); T[i](); } });
    ctl.append(camChips({ C, target: new THREE.Vector3(0, 0, 14), three: { yaw: 0.75, pitch: 0.5, dist: 40 }, top: { yaw: 0, pitch: 1.45, dist: 50 }, driver: bike }));
    st.show(true);
  });
}
