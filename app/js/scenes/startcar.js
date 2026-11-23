// Before starting the engine – a cut-away cockpit built from simple parts, plus the car seen from outside. Captions are those of the 2D flow in viz.js.
import { THREE, fig3, sfx, label, chipGroup, mat } from '../kit3d.js';
import { stepper } from './_flow3d.js';

const TB = 'לפי ספר הלימוד הרשמי "נוהגים אחרת – נוהגים נכון" (הרשות הלאומית לבטיחות בדרכים ומשרד התחבורה)';
const STEPS = ['מיד אחרי הכניסה לרכב לוחצים על בלם הרגל – עוד לפני כיוון הכיסא.', 'בודקים שבלם היד משוך, כדי שהרכב לא יזוז.',
  'ידית ההילוכים במצב סרק (N) ברכב ידני, ובמצב P או N ברכב אוטומטי. ברכב ידני לוחצים גם על המצמד.', 'מסובבים את המפתח לשלב הקפיצי, ומרפים מיד כשהמנוע מתניע – כדי לא לפגוע במתנע.'];
const TAGS = ['בלם רגל', 'בלם יד משוך', 'N או P', 'מתניעים'];

export default function startcar3d() {
  return fig3('לפני שמתניעים', TB + ', עמ׳ 16, 20', ({ C, W, ctl, say }) => {
    const { view } = C; view.min = 1.2; view.max = 30;
    W.env({ ground: 'grass', size: 120, shadowSize: 22, sunDir: [10, 30, 14] });
    W.asphalt(7, 0, 26, 12); W.line(-5.5, -5, 5, { w: 0.1 }); W.line(19.5, -5, 5, { w: 0.1 });
    const root = new THREE.Group(); C.scene.add(root);
    const part = (geo, color, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: 0x000000, ...o })); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
    const grey = 0x4b4f57, dark = 0x24272c, beige = 0xc9bfa8;
    root.add(part(new THREE.BoxGeometry(2.2, 0.06, 2.8), 0x30343b, 0, 0.03, 0));                               // floor
    root.add(part(new THREE.BoxGeometry(0.07, 0.7, 2.6), 0x8d949c, -1.1, 0.4, 0));   // door sills
    root.add(part(new THREE.BoxGeometry(2.2, 0.55, 0.4), grey, 0, 0.78, -1.2));                                // dashboard
    root.add(part(new THREE.BoxGeometry(2.2, 0.3, 0.5), dark, 0, 0.3, -1.15));                                // firewall
    // seat
    root.add(part(new THREE.BoxGeometry(0.55, 0.14, 0.55), beige, -0.45, 0.42, 0.45), part(new THREE.BoxGeometry(0.55, 0.78, 0.12), beige, -0.45, 0.82, 0.78));
    // steering wheel + column + ignition with key
    const wheel = part(new THREE.TorusGeometry(0.21, 0.028, 10, 28), dark, -0.45, 1.0, -0.62); wheel.rotation.x = -1.0; root.add(wheel);
    const col = part(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 10), dark, -0.45, 0.88, -0.78); col.rotation.x = -1.0; root.add(col);
    const ign = part(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), 0xa8afb8, -0.22, 0.93, -0.8, { metalness: 0.6 }); ign.rotation.x = Math.PI / 2; root.add(ign);
    const key = new THREE.Group(); key.position.set(-0.22, 0.93, -0.76); const kb = part(new THREE.BoxGeometry(0.07, 0.1, 0.012), 0xd9c14a, 0, 0.05, 0, { metalness: 0.5 }); key.add(kb); root.add(key);
    // pedals (pivot at the bottom): clutch, brake, accelerator
    const pedal = (x, w, color) => { const g = new THREE.Group(); g.position.set(x, 0.1, -0.78); const p = part(new THREE.BoxGeometry(w, 0.16, 0.03), color, 0, 0.08, 0); g.add(p); g.rotation.x = -0.45; root.add(g); return { g, p }; };
    const clutch = pedal(-0.67, 0.1, 0x8d949c), brake = pedal(-0.47, 0.14, 0x9aa2ab), accel = pedal(-0.2, 0.09, 0x6e757e);
    // centre console, handbrake lever, gear lever
    root.add(part(new THREE.BoxGeometry(0.28, 0.3, 1.15), dark, 0, 0.2, -0.1));
    const hb = new THREE.Group(); hb.position.set(0.02, 0.34, 0.2); const hbLever = part(new THREE.BoxGeometry(0.05, 0.34, 0.05), 0xb9bec5, 0, 0.17, 0); const hbGrip = part(new THREE.BoxGeometry(0.07, 0.07, 0.12), dark, 0, 0.36, 0); hb.add(hbLever, hbGrip); root.add(hb);
    const gs = new THREE.Group(); gs.position.set(0.02, 0.34, -0.45); const gsRod = part(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), 0xb9bec5, 0, 0.15, 0), gsKnob = part(new THREE.SphereGeometry(0.05, 12, 10), dark, 0, 0.32, 0); gs.add(gsRod, gsKnob); root.add(gs);
    const lamp = (c, x) => { const m = part(new THREE.CircleGeometry(0.025, 12), 0x222222, x, 0.98, -1.0, { side: THREE.DoubleSide }); m.rotation.y = 0; root.add(m); return m; };
    const lamps = [lamp(0xff3b30, -0.65), lamp(0xffb020, -0.58), lamp(0x4ade80, -0.51)];
    // labels above the part that matters in the step
    const FOCUS = [brake.p, hbGrip, gsKnob, kb], FPOS = [[-0.47, 0.75, -0.75], [0.02, 1.15, 0.2], [0.02, 0.95, -0.45], [-0.22, 1.35, -0.78]];
    let tag = null, cur = 0, pulse = 0;
    // exterior: the same car from outside
    const car = W.vehicle('evsedan', { name: 'car' }); car.position.set(14, 0, 0); car.rotation.y = Math.PI / 2 + 0.2; C.scene.add(car);
    const smoke = []; const sm = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, transparent: true, opacity: 0.5, roughness: 1, depthWrite: false });
    for (let i = 0; i < 10; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), sm.clone()); p.visible = false; p.userData.t = i / 10; car.add(p); smoke.push(p); }
    let started = false, eng = null, targets = { brake: -0.45, clutch: -0.45, hb: 0, gear: 0, key: 0 };
    C.onDispose(() => eng?.stop());
    const lerp = (a, b, k) => a + (b - a) * k;
    C.onFrame((dt, now) => {
      const k = Math.min(1, dt * 5), cl = (g, v) => { g.rotation.x = lerp(g.rotation.x, v, k); };
      cl(brake.g, targets.brake); cl(clutch.g, targets.clutch); hb.rotation.x = lerp(hb.rotation.x, targets.hb, k); gs.rotation.z = lerp(gs.rotation.z, targets.gear, k); key.rotation.z = lerp(key.rotation.z, targets.key, k);
      pulse = 0.5 + 0.5 * Math.sin(now * 5); for (const f of FOCUS) f.material.emissive.setHex(0x000000); const f = FOCUS[cur]; f.material.emissive.setRGB(0.25 * pulse, 0.7 * pulse, 0.3 * pulse);
      if (cur === 2) { clutch.p.material.emissive.setRGB(0.25 * pulse, 0.7 * pulse, 0.3 * pulse); } else clutch.p.material.emissive.setHex(0);
      for (const p of smoke) { p.visible = started; if (!started) continue; p.userData.t = (p.userData.t + dt * 0.5) % 1; const t = p.userData.t; p.position.set(0, 0.35 + t * 0.9, 2.5 + t * 1.5); p.scale.setScalar(0.8 + t * 2); p.material.opacity = 0.45 * (1 - t); }
      lamps[0].material.emissive.setHex(cur >= 3 && !started ? 0xff3b30 : 0); lamps[1].material.emissive.setHex(cur >= 3 && !started ? 0xffb020 : 0); lamps[2].material.emissive.setHex(started ? 0x2ecc71 : 0);
    });
    const T = [
      () => { targets = { brake: -0.95, clutch: -0.45, hb: -0.7, gear: 0, key: 0 }; started = false; },
      () => { targets = { brake: -0.95, clutch: -0.45, hb: -0.7, gear: 0, key: 0 }; started = false; },
      () => { targets = { brake: -0.95, clutch: -0.95, hb: -0.7, gear: 0.18, key: 0 }; started = false; },
      () => { targets = { brake: -0.95, clutch: -0.95, hb: -0.7, gear: 0.18, key: -0.9 }; sfx.ignition(); setTimeout(() => { if (cur === 3) { targets.key = 0; started = true; eng ||= sfx.engine(); eng.set(0.4); setTimeout(() => { eng?.stop(); eng = null; }, 1600); } }, 900); },
    ];
    targets.hb = 0;
    const setTag = i => { if (tag) { root.remove(tag); tag.material.map?.dispose(); } tag = label(TAGS[i], { size: 0.34, bg: 'rgba(30,140,80,.95)' }); tag.position.set(...FPOS[i]); root.add(tag); };
    const st = stepper({ ctl, say, steps: STEPS, onShow: (i, instant) => { cur = i; started = false; eng?.stop(); eng = null; if (i === 0) { targets = { brake: -0.45, clutch: -0.45, hb: 0, gear: 0, key: 0 }; if (instant) { brake.g.rotation.x = clutchRest(); } } setTag(i); T[i](); if (i === 0) targets.hb = 0; W.setBrake(car, true); } });
    function clutchRest() { return -0.45; }
    const T0 = new THREE.Vector3(-0.25, 0.5, -0.3), TX = new THREE.Vector3(14, 0.8, 0);
    Object.assign(view, { yaw: 1.0, pitch: 0.9, dist: 3.9 }); view.target.copy(T0);
    const cams = { cockpit: { yaw: 1.0, pitch: 0.9, dist: 3.9, target: T0 }, top: { yaw: 0, pitch: 1.45, dist: 4.2, target: T0 }, out: { yaw: 0.9, pitch: 0.35, dist: 12, target: TX } };
    ctl.append(chipGroup([['cockpit', 'בתוך הרכב'], ['top', 'מלמעלה'], ['out', 'הרכב מבחוץ']], 'cockpit', k => { view.driver = null; view.goal = { ...cams[k], target: cams[k].target.clone() }; }));
    st.show(true); W.setBrake(car, true);
  });
}
