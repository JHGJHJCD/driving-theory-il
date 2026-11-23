// A tyre blows out while driving – real models. Captions are those of the 2D flow in viz.js.
import { THREE, fig3, sfx, LANE, label } from '../kit3d.js';
import { Actors, stepper, camChips, hazard } from './_flow3d.js';

const STEPS = ['אוחזים היטב בהגה ושומרים על נסיעה בקו ישר.', 'מאטים ככל האפשר בעזרת הבלמים ותיבת ההילוכים.', 'משתלבים בימין הדרך, ועדיף בשול – גם אם צריך לנסוע על החישוק ולהרוס את הצמיג, ולא לעצור על הכביש.'];
const TAGS = [['אוחזים בהגה', 'rgba(30,140,80,.95)'], ['מאטים', 'rgba(30,140,80,.95)'], ['לימין – עדיף בשול', 'rgba(30,140,80,.95)']];

export default function blowout3d() {
  return fig3('צמיג התפוצץ בנסיעה', 'לפי חוברת "כללי בטיחות בדרכים" של הרשות הלאומית לבטיחות בדרכים (מרץ 2026), עמ׳ 44–45', ({ C, W, ctl, say }) => {
    W.env({ ground: 'grass', size: 220, shadowSize: 60 });
    W.roadZ({ z0: -130, z1: 110, centre: 'dash', kerbs: false });
    for (const s of [-1, 1]) W.flat(s * 5.4, -10, 3.2, 240, 0xb8a98a, { y: 0.02, rough: 1 });            // shoulders
    const tr = []; for (let z = -120; z < 100; z += 13) tr.push([-12.5, z], [12.5, z + 6]); W.trees(tr);
    const me = W.vehicle('ev', { name: 'me' }); C.scene.add(me);
    const A = new Actors(C), a = A.add(me, { x: LANE, z: 60, h: 0 });
    for (const [x, z] of [[5.6, 8], [5.6, 1.5]]) W.cone(x, z);
    // the flat tyre: a red burst at the front left wheel, sparks when running on the rim
    const burst = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff2010, emissiveIntensity: 1.5, transparent: true, opacity: 0.8 })); burst.position.set(1.0, 0.45, -1.5); burst.visible = false; me.add(burst);
    const sparks = []; for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffb020 })); s.visible = false; s.userData.t = i / 10; me.add(s); sparks.push(s); }
    let hz = false, rim = false, tag = null, prev = { x: a.p.x, z: a.p.z }, hd = 0;
    C.onFrame((dt, now) => {
      hazard(me, now, hz); burst.scale.setScalar(1 + 0.15 * Math.sin(now * 12));
      const dx = a.p.x - prev.x, dz = a.p.z - prev.z; prev = { x: a.p.x, z: a.p.z };
      const want = a.moving && Math.hypot(dx, dz) > 1e-4 ? Math.atan2(-dx, -dz) : 0; hd += (want - hd) * Math.min(1, dt * 4); me.rotation.y = hd;
      me.rotation.z = rim ? 0.035 : 0.02;
      for (const s of sparks) { s.visible = rim && a.moving; s.userData.t = (s.userData.t + dt * 2.2) % 1; const t = s.userData.t; s.position.set(1.05 + t * 0.5, 0.2 + Math.sin(t * 3) * 0.2, -1.5 + t * 1.2); }
    });
    const setTag = i => { if (tag) { me.remove(tag); tag.material.map?.dispose(); } tag = label(TAGS[i][0], { size: 1.3, bg: TAGS[i][1] }); tag.position.set(0, 3.5, 0); me.add(tag); };
    const T = [
      () => { hz = false; rim = false; burst.visible = true; W.setBrake(me, false); A.goto([[a, { x: LANE, z: 34, h: 0 }]], 3.4); },
      () => { burst.visible = true; rim = false; A.goto([[a, { x: LANE, z: 14, h: 0 }]], 3.8); setTimeout(() => { if (cur === 1) { W.setBrake(me, true); sfx.brake(); } }, 500); },
      () => { burst.visible = true; W.setBrake(me, true); rim = true; A.goto([[a, { x: 5.4, z: -14, h: 0 }]], 5.5); setTimeout(() => { if (cur === 2) { hz = true; rim = false; } }, 5500); },
    ];
    let cur = 0;
    const st = stepper({ ctl, say, steps: STEPS, onShow: (i, instant) => { cur = i; if (instant) { A.goto([[a, { x: LANE, z: 60 }]], 0.01, true); prev = { x: a.p.x, z: a.p.z }; hd = 0; } setTag(i); T[i](); } });
    C.onFrame(() => { if (!C.view.driver) { C.view.target.z += 0; } });
    ctl.append(camChips({ C, target: new THREE.Vector3(3, 0, 12), three: { yaw: 0.9, pitch: 0.42, dist: 34 }, top: { yaw: 0, pitch: 1.45, dist: 46 }, driver: me }));
    st.show(true);
  });
}
