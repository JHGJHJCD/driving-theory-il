// Before leaving with a load (TR 85(א), 88). Captions copied from the 2D flow in viz.js.
import { THREE, LANE, label } from '../kit3d.js';
import { flowScene } from './_flow.js';

const STEPS = [
  ['מחוזק', 'המטען מחוזק כך שלא יישמט ולא יתרופף, והמשקל לא עולה על המותר ברישיון (85(א)).'],
  ['בולט?', 'לא בולט מהדפנות לצדדים, ולא יותר ממטר אחד מעבר לחזית או לגב הרכב (85(א)(1)).'],
  ['גובה', 'גובה מרבי מפני הדרך לפי המשקל הכולל: עד 1,500 ק"ג – 2.50 מ׳; עד 3,500 – 3.00; עד 8,000 – 3.50; מעל – 4.00 (85(א)(2)(א)).'],
  ['לא\nמסתיר', 'לא חוסם את שדה הראייה ולא מסתיר פנסים, לוחיות זיהוי ומחווני כיוון (85(א)(2)).'],
  ['משולש', 'בולט מלפנים או מאחור? מסמנים במשולש בקצה – בכל שעה, גם בעמידה ובחנייה (88).']];

export default function load3d() {
  return flowScene({ title: 'לפני שיוצאים עם מטען', src: 'לפי תקנות 85(א) ו־88', steps: STEPS, tagSize: 1.0,
    cams: { three: { yaw: 0.9, pitch: 0.42, dist: 13 }, top: { yaw: 0, pitch: 1.45, dist: 14 } }, target: [LANE, 1.2, 1.2],
    setup({ C, W, tw }) {
      W.env({ ground: 'grass', size: 200, shadowSize: 40 });
      W.roadZ({ z0: -110, z1: 110, centre: 'dash' }); W.street({ z0: -110, z1: 110, xLeft: -14, xRight: 14, seed: 31 });
      const truck = W.vehicle('pickup'); truck.position.set(LANE, 0, 0); C.scene.add(truck);
      const BZ = 1.35, BY = 0.62;                                              // bed centre (local z) and floor height
      const cargo = new THREE.Group(); truck.add(cargo);
      const bx = (x, y, z, sc = 1.25) => { const g = W.prop('cars/box', { scale: sc, x, z }); g.position.y = y; cargo.add(g); return g; };
      bx(0, BY, BZ - 0.55); bx(0, BY, BZ + 0.45); bx(0, BY + 0.9, BZ - 0.05);
      const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o });
      const strapMat = M(0x222b6b), straps = [];
      for (const z of [BZ - 0.6, BZ + 0.45]) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.07), strapMat); s.position.set(0, BY + 1.8, z); cargo.add(s); straps.push(s); for (const sx of [-1, 1]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 0.07), strapMat); v.position.set(sx * 0.62, BY + 1.2, z); cargo.add(v); straps.push(v); } }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 3.2), M(0xb98a52)); beam.position.set(0.4, BY + 0.35, 1.9); cargo.add(beam);   // sticks 1 m out of the tail (tail at z = 2.5)
      beam.castShadow = true; beam.visible = false;
      const zoneR = W.flat(LANE, 3.0, 1.6, 1.0, 0x2ecc71, { y: 0.06, opacity: 0.55, emissive: 0x2ecc71 }), zoneF = W.flat(LANE, -3.0, 1.6, 1.0, 0x2ecc71, { y: 0.06, opacity: 0.55, emissive: 0x2ecc71 });
      const zoneS = [-1, 1].map(sx => W.flat(LANE + sx * 1.35, 0.2, 0.7, 5, 0xe5483f, { y: 0.06, opacity: 0.45, emissive: 0xe5483f }));
      const lab = (t, x, y, z, bg, size = 0.8) => { const l = label(t, { size, bg }); l.position.set(x, y, z); C.scene.add(l); l.visible = false; return l; };
      const L1 = lab('1 מ׳ לכל היותר', LANE, 1.6, 3.0, 'rgba(30,140,80,.95)'), L2 = lab('1 מ׳ לכל היותר', LANE, 1.6, -3.0, 'rgba(30,140,80,.95)'), L3 = lab('לא לצדדים', LANE + 2.4, 1.4, 0.2, 'rgba(200,40,40,.95)');
      // height gauge on the road centre line, ticks at the lesson's heights
      const gauge = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.4, 8), M(0x8d949c, { metalness: .5 })); pole.position.y = 2.2; gauge.add(pole);
      const ticks = [[2.5, 'עד 1,500 ק"ג – 2.50 מ׳'], [3.0, 'עד 3,500 – 3.00'], [3.5, 'עד 8,000 – 3.50'], [4.0, 'מעל – 4.00']];
      ticks.forEach(([hgt, t], k) => { const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.06), M([0x2ecc71, 0x3aa0ff, 0xf5b301, 0xe5483f][k], { emissive: [0x2ecc71, 0x3aa0ff, 0xf5b301, 0xe5483f][k], emissiveIntensity: .4 })); b.position.set(-0.55, hgt, 0); gauge.add(b); const l = label(t, { size: 0.5, bg: 'rgba(20,30,50,.9)' }); l.position.set(-2.2, hgt, 0); gauge.add(l); });
      gauge.position.set(-0.7, 0, 1.8); gauge.visible = false; C.scene.add(gauge);
      // rear: plate + lamps
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.03), M(0xf2c200)); plate.position.set(0, 0.7, 2.53); truck.add(plate); plate.visible = false;
      const pl = lab('לוחית זיהוי', LANE, 1.3, 3.3, 'rgba(20,90,70,.95)', 0.5), ll = lab('פנסים', LANE + 1.3, 1.7, 3.3, 'rgba(20,90,70,.95)', 0.5), il = lab('מחווני כיוון', LANE - 1.3, 1.5, 3.3, 'rgba(20,90,70,.95)', 0.5);
      // red warning triangle on the tip of the beam
      const sh = new THREE.Shape(); sh.moveTo(0, 0.6); sh.lineTo(-0.52, -0.3); sh.lineTo(0.52, -0.3); sh.closePath(); const hole = new THREE.Path(); hole.moveTo(0, 0.38); hole.lineTo(-0.33, -0.18); hole.lineTo(0.33, -0.18); hole.closePath(); sh.holes.push(hole);
      const tri = new THREE.Mesh(new THREE.ShapeGeometry(sh), M(0xd8232a, { side: THREE.DoubleSide, emissive: 0x551010, emissiveIntensity: .5 })); const tri2 = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, .38), new THREE.Vector2(-.33, -.18), new THREE.Vector2(.33, -.18)])), M(0xffffff, { side: THREE.DoubleSide }));
      const tg = new THREE.Group(); tg.add(tri, tri2); tri2.position.z = -0.001; tg.position.set(0.4, BY + 0.95, 3.6); truck.add(tg); tg.visible = false;
      const show = o => { for (const [k, v] of Object.entries(o)) v.visible = !!v.visible && false; };
      const vis = (list, on) => list.forEach(x => { x.visible = on; });
      return {
        step(i) {
          vis([zoneR, zoneF, ...zoneS, L1, L2, L3, gauge, plate, pl, ll, il, tg, beam], false); vis(straps, i === 0);
          cargo.children.forEach(c => { if (c !== beam) c.visible = true; });
          if (i === 0) return { tag: [LANE, 3.9, 1.2], look: [LANE, 1.2, 1.2], view: { yaw: 0.9, pitch: 0.42, dist: 11 } };
          if (i === 1) { beam.visible = true; vis([zoneR, zoneF, ...zoneS, L1, L2, L3], true); return { tag: [LANE, 3.9, 0], look: [LANE, 0.8, 0.4], view: { yaw: 1.15, pitch: 0.6, dist: 13 } }; }
          if (i === 2) { gauge.visible = true; return { tag: [-0.7, 5.2, 1.8], look: [0, 1.8, 1.0], view: { yaw: 0.9, pitch: 0.28, dist: 14 } }; }
          if (i === 3) { plate.visible = pl.visible = ll.visible = il.visible = true; return { tag: [LANE, 3.9, 2.6], look: [LANE, 1.0, 2.0], view: { yaw: 2.65, pitch: 0.3, dist: 9 } }; }
          if (i === 4) { beam.visible = true; tg.visible = true; return { tag: [LANE, 4.1, 3.4], look: [LANE, 1.0, 2.6], view: { yaw: 2.5, pitch: 0.32, dist: 9.5 } }; }
        },
      };
    } });
}
