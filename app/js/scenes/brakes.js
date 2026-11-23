// The brakes fail: what to do – real models on a downhill road (a tilted world). Captions are those of the 2D flow in viz.js.
import { THREE, fig3, sfx, LANE, label, reduced } from '../kit3d.js';
import { Actors, stepper, camChips } from './_flow3d.js';

const STEPS = ['מאטים בעזרת תיבת ההילוכים – מורידים הילוך.', 'משתמשים בבלם היד ומרימים אותו לאט לאט.', 'לא לוחצים על הבלמים ברציפות לאורך זמן – זה מחמם אותם עד שריפה.'];
const TAGS = [['מורידים הילוך', 'rgba(30,140,80,.95)'], ['בלם יד – לאט לאט', 'rgba(30,140,80,.95)'], ['לא בלימה רציפה', 'rgba(200,40,40,.95)']];
const TH = 0.12;   // slope (rad), the road goes down towards -Z

export default function brakes3d() {
  return fig3('הבלמים לא עובדים: מה עושים', 'לפי חוברת "כללי בטיחות בדרכים" של הרשות הלאומית לבטיחות בדרכים (מרץ 2026), עמ׳ 43', ({ C, W, ctl, say }) => {
    W.env({ ground: 'grass', size: 220, shadowSize: 60 });
    const hill = new THREE.Group(); hill.rotation.x = -TH; C.scene.add(hill);
    hill.add(W.ground);
    const before = new Set(C.scene.children);
    W.roadZ({ z0: -120, z1: 100, centre: 'dash' });
    const tr = []; for (let z = -110; z < 90; z += 14) { tr.push([-14, z], [14, z + 6]); } W.trees(tr);
    for (const c of C.scene.children.filter(c => !before.has(c))) hill.add(c);
    const sy = Math.sin(TH), cy = Math.cos(TH);
    const me = W.vehicle('ev', { name: 'me' }); hill.add(me);
    const tag = label('', { size: 1.4 }); tag.visible = false;
    const A = new Actors(C), a = A.add(me, { x: LANE, z: 70, h: 0 });
    // camera proxy for the driver view (the car lives inside the tilted group)
    const proxy = new THREE.Object3D(); proxy.userData.eye = me.userData.eye; C.scene.add(proxy);
    C.onFrame(() => { proxy.position.set(a.p.x, a.p.z * sy, a.p.z * cy); proxy.rotation.y = a.p.h; proxy.userData.eye = me.userData.eye; if (!C.view.driver) C.view.target.set(LANE * 0.5, a.p.z * sy + 1, a.p.z * cy); });
    // smoke from hot brakes
    const puffs = []; const sm = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, transparent: true, opacity: 0.6, roughness: 1, depthWrite: false });
    for (let i = 0; i < 16; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), sm.clone()); p.visible = false; p.userData = { t: Math.random(), side: i % 2 ? 1 : -1 }; me.add(p); puffs.push(p); }
    const glow = new THREE.PointLight(0xff5a1a, 0, 7); glow.position.set(0, 0.5, -1.4); me.add(glow);
    let smoke = false, label3 = null;
    C.onFrame((dt, now) => {
      glow.intensity = smoke ? 8 + Math.sin(now * 9) * 2 : 0;
      for (const p of puffs) { p.visible = smoke; if (!smoke) continue; p.userData.t = (p.userData.t + dt * 0.45) % 1; const t = p.userData.t;
        p.position.set(p.userData.side * 0.95, 0.4 + t * 2.2, -1.2 + t * 1.4); p.scale.setScalar(0.6 + t * 1.6); p.material.opacity = 0.55 * (1 - t); }
    });
    const T = [
      () => { smoke = false; W.setBrake(me, false); A.goto([[a, { x: LANE, z: 24 }]], 4.2); },
      () => { smoke = false; A.goto([[a, { x: LANE, z: 0 }]], 4.6); setTimeout(() => { if (cur === 1) { W.setBrake(me, true); sfx.handbrake(); } }, 700); },
      () => { A.goto([[a, { x: LANE, z: -14 }]], 3.4); smoke = true; W.setBrake(me, false); },
    ];
    let cur = 0; const setTag = i => { if (label3) { me.remove(label3); label3.material.map?.dispose(); } label3 = label(TAGS[i][0], { size: 1.3, bg: TAGS[i][1] }); label3.position.set(0, 3.4, 0); me.add(label3); };
    const st = stepper({ ctl, say, steps: STEPS, onShow: (i, instant) => { cur = i; if (instant) { A.goto([[a, { x: LANE, z: 70 }]], 0.01, true); W.setBrake(me, false); smoke = false; } setTag(i); T[i](); } });
    ctl.append(camChips({ C, target: new THREE.Vector3(LANE * 0.5, 3, 14), three: { yaw: 0.95, pitch: 0.32, dist: 26 }, top: { yaw: 0, pitch: 1.4, dist: 40 }, driver: proxy }));
    st.show(true);
  });
}
