// A tractor on the road (TR 38, 54, 359א). Captions copied from the 2D flow in viz.js.
import { THREE, LANE, LANE_W, Path, place, label, sfx, reduced } from '../kit3d.js';
import { flowScene } from './_flow.js';

const STEPS = [
  ['עד 40\nקמ"ש', 'טרקטור, רכב איטי ומכונה ניידת נוסעים לכל היותר 40 קמ"ש (54(א)).'],
  ['לא בדרך\nמהירה', 'דרך מהירה סגורה בפני טרקטור (54(א)).'],
  ['צד\nימין', 'טרקטור ורכב איטי נוסעים בכביש בצד ימין (38(א)).'],
  ['מדרכה –\nרק חצייה', 'על מדרכה או שביל עוברים רק כדי לחצות אותם בכניסה לחצרים או ביציאה מהם (38(א)).'],
  ['זמזם\nלאחור', 'בטרקטור מותקן זמזם שפועל אוטומטית עם ההילוך האחורי (359א(א)).']];

export default function tractor3d() {
  return flowScene({ title: 'טרקטור בדרך', src: 'לפי תקנות 38, 54, 359א', steps: STEPS,
    cams: { three: { yaw: 0.9, pitch: 0.5, dist: 30 }, top: { yaw: 0, pitch: 1.45, dist: 36 } }, target: [4, 0.8, 0], tagSize: 1.2,
    setup({ C, W, tw, view }) {
      const R = LANE_W + LANE;                       // x of the right-most lane centre on a 2+2 lane road (5.7)
      W.env({ ground: 'grass', size: 240, shadowSize: 60 });
      W.roadZ({ z0: -140, z1: 140, lanes: 2, centre: 'solid' });
      W.street({ z0: -140, z1: -18, xLeft: -16, xRight: 16, seed: 21 }); W.street({ z0: 18, z1: 140, xLeft: -16, xRight: 16, seed: 22 });
      // yard with a gate on the right of the road (step 4)
      W.flat(15.5, 0, 9, 9, 0xb9ab8a, { y: 0.02, rough: 1 });
      for (const [z, ry] of [[-7, 0], [-4.2, 0], [4.2, 0], [7, 0]]) W.prop('city/fence', { scale: 8, x: 11.2, z, ry: Math.PI / 2 });
      const T = W.vehicle('tractor'); C.scene.add(T);
      const mkCar = (k, x) => { const c = W.vehicle(k); c.position.x = x; C.scene.add(c); return c; };
      const car1 = mkCar('evsedan', R), car2 = mkCar('ev', R), pass = mkCar('ev', LANE);
      const lab40 = label('עד 40 קמ"ש', { size: 0.9, bg: 'rgba(160,110,0,.95)' }); lab40.position.set(0, 3.2, 0); T.add(lab40);
      // expressway section: median barrier + sign
      const expr = new THREE.Group(); const med = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 70), new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: .8 })); med.position.set(0, 0.45, -30); med.castShadow = true; expr.add(med); C.scene.add(expr);
      const sgn = W.sign('info', { x: 9.0, z: -10, ry: 0, text: 'דרך מהירה', size: 1.6, h: 3.2 });
      const no = label('✕', { size: 1.3, bg: 'rgba(200,40,40,.95)' }); no.position.set(R, 3.4, -4); C.scene.add(no);
      const stayR = W.flat(R, 0, LANE_W - 0.5, 280, 0x2ecc71, { y: 0.06, opacity: 0.35, emissive: 0x2ecc71 });
      const cross = label('חוצה בלבד', { size: 0.8, bg: 'rgba(160,110,0,.95)' }); cross.position.set(11, 3.4, 0); C.scene.add(cross);
      const rings = new THREE.Group(); for (let r = 0; r < 3; r++) { const m = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.8 })); rings.add(m); } rings.position.set(0, 1.2, 1.9); T.add(rings);
      const buzz = label('זמזם', { size: 0.6, bg: 'rgba(200,120,0,.95)' }); buzz.position.set(0, 3.0, 2.6); T.add(buzz);
      const path = new Path([{ t: 'l', a: [R, 14], b: [R, 8] }, { t: 'q', a: [R, 8], c: [R, 0], b: [10, 0] }, { t: 'l', a: [10, 0], b: [17, 0] }]);
      let mode = 'loop', speed = 9, s = 0, st = { z: 0 }, beepT = 0;
      const setAll = (vis) => { expr.visible = no.visible = sgn.visible = vis.expr; stayR.visible = vis.right; cross.visible = vis.cross; rings.visible = buzz.visible = vis.buzz; lab40.visible = vis.l40; pass.visible = vis.pass; car1.visible = car2.visible = vis.cars; };
      const pose = (z, a, b, c) => { T.position.set(R, 0, z); T.rotation.y = 0; car1.position.set(R, 0, z + 14); car2.position.set(R, 0, z + 27); pass.position.set(LANE, 0, z + 20); };
      return {
        step(i, first) {
          if (first) { tw.clear(); mode = 'loop'; }
          if (i === 0) { setAll({ expr: false, right: false, cross: false, buzz: false, l40: true, pass: true, cars: true }); mode = 'loop'; pose(10); speed = 9; return { tag: [R, 4.6, 0], look: [4, 0.8, 0] }; }
          if (i === 1) { setAll({ expr: true, right: false, cross: false, buzz: false, l40: false, pass: true, cars: false }); no.visible = true; mode = 'stop'; pose(24); T.rotation.y = 0; const z0 = T.position.z; tw.move(T, { z: -4 }, 2.6, { e: k => 1 - (1 - k) * (1 - k) }); pass.position.set(LANE, 0, 20); tw.move(pass, { z: -70 }, 5, { e: k => k }); return { tag: [R, 5.2, -4], look: [4, 0.8, -6] }; }
          if (i === 2) { setAll({ expr: false, right: true, cross: false, buzz: false, l40: false, pass: true, cars: true }); mode = 'loop'; pose(10); speed = 9; return { tag: [R, 4.6, 0], look: [4, 0.8, 0] }; }
          if (i === 3) { setAll({ expr: false, right: false, cross: true, buzz: false, l40: false, pass: false, cars: false }); mode = 'path'; s = reduced() ? path.len : 0; place(T, path.at(s)); return { tag: [11, 4.6, 0], look: [10, 0.8, 0] }; }
          if (i === 4) { setAll({ expr: false, right: false, cross: false, buzz: true, l40: false, pass: false, cars: false }); mode = 'reverse'; T.position.set(R, 0, -14); T.rotation.y = 0; st.z = -14; if (reduced()) { T.position.z = -4; mode = 'none'; } return { tag: [R, 4.6, -8], look: [4, 0.8, -8] }; }
        },
        frame(dt, now) {
          if (mode === 'loop') { const z = T.position.z - speed * dt; const nz = z < -50 ? 40 : z; const dz = nz - T.position.z; T.position.z = nz; car1.position.z += dz; car2.position.z += dz; if (pass.visible) { pass.position.z -= (speed * 1.8) * dt; if (pass.position.z < -70) pass.position.z = 40; } if (dz > 0) { car1.position.z = nz + 14; car2.position.z = nz + 27; } }
          else if (mode === 'path') { if (s < path.len) { s = Math.min(path.len, s + 4.5 * dt); place(T, path.at(s)); } }
          else if (mode === 'reverse') { if (T.position.z < -4) { T.position.z += 2.2 * dt; beepT -= dt; if (beepT <= 0) { sfx.beep(); beepT = 0.7; } } }
          if (rings.visible) rings.children.forEach((m, k) => { const u = ((now * 1.2 + k / 3) % 1); m.scale.setScalar(0.4 + u * 2.2); m.material.opacity = 0.8 * (1 - u); m.rotation.y = Math.PI / 2; });
        },
      };
    } });
}
