// Child in the car: which seat? (TR 83א) – a cut-away cabin with a child seat. Captions copied from the 2D flow in viz.js.
import { THREE, label, reduced } from '../kit3d.js';
import { flowScene } from './_flow.js';

const STEPS = [
  ['עד\nשנה', 'עד גיל שנה: גב מושב הבטיחות מופנה לחזית הרכב (83א(ג)).'],
  ['עד 3', 'עד גיל 3: רק במושב בטיחות שמתאים לגובהו ולמשקלו (83א(ב)(1)).'],
  ['3 עד 8', 'מגיל 3 ועד 8: מושב בטיחות או מושב מגביה (83א(ב)(2)).'],
  ['כרית\nאוויר', 'לא מושיבים ילד במושב בטיחות או מגביה מול כרית אוויר פעילה (83א(ד)).']];

export default function kids3d() {
  return flowScene({ title: 'ילד ברכב: איזה מושב?', src: 'לפי תקנה 83א', steps: STEPS,
    cams: { three: { yaw: 0.55, pitch: 0.85, dist: 7.5 }, top: { yaw: 0, pitch: 1.5, dist: 8 } }, target: [0, 0.5, 0.2],
    setup({ C, W, tw }) {
      W.env({ ground: 'plain', size: 60, shadowSize: 12, sunDir: [10, 40, 12] });
      const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o });
      const box = (w, h, d, c, x, y, z, parent = C.scene, o = {}) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c, o)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
      // cabin: the front of the car points to -Z
      box(2.4, 0.08, 4.0, 0x4d5259, 0, 0.04, 0.1); box(0.1, 0.55, 4.0, 0xc4492e, -1.2, 0.3, 0.1); box(0.1, 0.55, 4.0, 0xc4492e, 1.2, 0.3, 0.1);
      box(2.3, 0.75, 0.6, 0x2b2f36, 0, 0.45, -1.7);                                             // dashboard
      for (const sx of [-0.55, 0.55]) { box(0.7, 0.18, 0.7, 0x69707a, sx, 0.3, -0.45); box(0.7, 0.85, 0.16, 0x69707a, sx, 0.85, -0.02); }   // front seats
      box(2.1, 0.18, 0.7, 0x69707a, 0, 0.3, 0.95); box(2.1, 0.9, 0.16, 0x69707a, 0, 0.88, 1.35);   // rear bench
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 20), M(0x111111)); wheel.position.set(-0.55, 0.95, -1.28); wheel.rotation.x = 0.9; C.scene.add(wheel);
      const front = label('חזית הרכב', { size: 0.4, bg: 'rgba(60,66,76,.9)' }); front.position.set(0, 1.35, -1.75); C.scene.add(front);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 3), M(0xffffff)); arrow.rotation.x = -Math.PI / 2; arrow.position.set(0, 0.16, -1.25); C.scene.add(arrow);
      // child seat: shell + base; booster = a block
      const seat = new THREE.Group(); box(0.6, 0.14, 0.55, 0x2f6fb8, 0, 0.07, 0, seat); box(0.6, 0.62, 0.12, 0x2f6fb8, 0, 0.4, 0.22, seat); box(0.1, 0.3, 0.45, 0x2f6fb8, -0.3, 0.22, 0, seat); box(0.1, 0.3, 0.45, 0x2f6fb8, 0.3, 0.22, 0, seat); C.scene.add(seat);
      const booster = new THREE.Group(); box(0.55, 0.2, 0.5, 0x2f9d6a, 0, 0.1, 0, booster); C.scene.add(booster);
      const kid = W.person(9, { anim: 'sit', height: 0.8 }); C.scene.add(kid);
      // an active airbag opening from the dashboard (translucent red)
      const bag = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff3b30, transparent: true, opacity: 0.55, emissive: 0xff3b30, emissiveIntensity: 0.4 })); bag.scale.set(1, 0.9, 1.1); bag.position.set(0.55, 0.95, -1.0); bag.visible = false; C.scene.add(bag);
      const cross = label('✕', { size: 1.1, bg: 'rgba(200,40,40,.95)' }); cross.position.set(0.55, 2.0, -0.4); cross.visible = false; C.scene.add(cross);
      const bagLbl = label('כרית אוויר פעילה', { size: 0.45, bg: 'rgba(200,40,40,.95)' }); bagLbl.position.set(0.55, 1.6, -1.2); bagLbl.visible = false; C.scene.add(bagLbl);
      return {
        step(i) {
          bag.visible = cross.visible = bagLbl.visible = false; arrow.visible = i === 0; front.visible = i === 0;
          booster.visible = i === 2; seat.visible = i !== 2;
          if (i === 0) { seat.position.set(0.55, 0.38, 0.95); seat.rotation.y = Math.PI; kid.position.set(0.55, 0.52, 0.95); kid.rotation.y = Math.PI; kid.scale.setScalar(0.85); return { tag: [0.55, 2.4, 0.95], look: [0, 0.6, 0.2] }; }
          if (i === 1) { seat.position.set(0.55, 0.38, 0.95); seat.rotation.y = 0; kid.position.set(0.55, 0.52, 0.95); kid.rotation.y = 0; return { tag: [0.55, 2.4, 0.95] }; }
          if (i === 2) { booster.position.set(0.55, 0.38, 0.95); kid.position.set(0.55, 0.58, 0.95); kid.rotation.y = 0; kid.scale.setScalar(1.1); return { tag: [0.55, 2.4, 0.95] }; }
          if (i === 3) { kid.scale.setScalar(0.85); seat.position.set(0.55, 0.38, -0.45); seat.rotation.y = 0; kid.position.set(0.55, 0.52, -0.45); kid.rotation.y = 0; bag.visible = cross.visible = bagLbl.visible = true; return { tag: [0.55, 2.7, -0.45], look: [0.3, 0.6, -0.4] }; }
        },
        frame(dt, now) { if (bag.visible) bag.scale.setScalar(1 + Math.sin(now * 4) * 0.04); },
      };
    } });
}
