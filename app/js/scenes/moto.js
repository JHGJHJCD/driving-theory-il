// Where is the road slippery? The oily lane centre – real models. Same caption and checkbox as the 2D figure in viz.js (Q1603, Q1605).
import { THREE, fig3, LANE, place, reduced } from '../kit3d.js';
import { camChips } from './_flow3d.js';
import { h } from '../ui.js';

export default function moto3d() {
  return fig3('איפה הכביש חלקלק?', 'לפי שאלות 1603 ו־1605 במאגר', ({ C, W, ctl, say }) => {
    W.env({ ground: 'grass', size: 200, shadowSize: 50 });
    W.roadZ({ z0: -120, z1: 120, centre: 'dash' });
    W.street({ z0: -110, z1: 100, xLeft: -9.2, xRight: 9.2, seed: 12 });
    // the dark, greasy strip in the middle of the lane, and one fresh patch ahead
    const gloss = { rough: 0.18, opacity: 0.5 };
    const strip = W.flat(LANE, 0, 1.2, 240, 0x101216, { y: 0.034, ...gloss });
    const patch = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.06, metalness: 0.5, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    patch.rotation.x = -Math.PI / 2; patch.scale.set(1.25, 2.4, 1); patch.position.set(LANE, 0.04, -14); patch.receiveShadow = true; C.scene.add(patch);
    const path = W.flat(LANE, -4, 0.22, 100, 0x2ecc71, { y: 0.05, opacity: 0.9, emissive: 0x2ecc71 });
    const bike = W.moto({ riderIndex: 3 }); C.scene.add(bike);
    let z = 22, on = true;
    place(bike, { x: LANE, z, h: 0 });
    C.onFrame((dt) => {
      const v = reduced() ? 0 : 7; z -= v * dt; if (z < -40) z = 22; bike.position.set(LANE, 0, z); bike.rotation.y = 0;
      for (const w of bike.userData.wheels) w.rotation.x -= v * dt / 0.34;
    });
    const chk = h('input', { type: 'checkbox', id: 'vz3-oil', checked: true });
    const run = () => { on = chk.checked; patch.visible = path.visible = on;
      say('אמצע הנתיב (הפס הכהה באיור) הוא האזור המלוכלך והשמנוני ביותר בכביש, כי שם מטפטף שמן מכלי רכב. ' + (on ? 'יש כתם שמנוני לפניך: עוברים אותו בקו ישר, בלי להאיץ ובלי לבלום.' : '')); };
    chk.addEventListener('change', run);
    ctl.append(h('label', { class: 'check' }, chk, h('span', { text: 'להראות כתם שמנוני לפניי' })), camChips({ C, target: new THREE.Vector3(LANE, 0, -8), three: { yaw: 0.7, pitch: 0.5, dist: 28 }, top: { yaw: 0, pitch: 1.45, dist: 36 }, driver: bike }));
    run();
  });
}
