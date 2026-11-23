// Electric crossover / saloon built from smooth extruded profiles (no brand marks): closed front with a full-width light bar, glass roof,
// flush body, aero wheels. Same lamp interface as the other vehicles (userData.brake / head / blink), front = -Z, y = 0 on the road.
import * as THREE from '../vendor/three.module.min.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45, ...o });

// extrude a side profile [[z,y],...] over a width; the result is centred on x = 0
function body(points, width, bevel) {
  const sh = new THREE.Shape(); points.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y))); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 5, curveSegments: 8 });
  g.translate(0, 0, -(width - bevel * 2) / 2); g.rotateY(-Math.PI / 2); g.computeVertexNormals(); return g;
}

export function buildEV({ color = 0x6c7077, variant = 'suv' } = {}) {
  const L = variant === 'sedan' ? 4.95 : 4.75, Wd = 1.94, g = new THREE.Group();
  const paint = std(color, { roughness: 0.28, metalness: 0.55, clearcoat: undefined }), glass = std(0x0d1218, { roughness: 0.08, metalness: 0.7, transparent: true, opacity: 0.9 }), dark = std(0x16181c, { roughness: 0.7, metalness: 0.1 });
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const f = -L / 2, r = L / 2;
  // lower body: closed nose, long smooth hood, high rear deck
  add(body([[f + 0.13, 0.30], [f + 0.02, 0.44], [f, 0.62], [f + 0.14, 0.80], [f + 1.15, 1.02], [f + 1.55, 1.06], [r - 0.35, 1.08], [r - 0.06, 0.98], [r, 0.84], [r, 0.52], [r - 0.14, 0.30]], Wd, 0.1), paint);
  // greenhouse (glass): raked windscreen, long roof, fastback (suv) or notch (sedan)
  const cab = variant === 'sedan'
    ? [[f + 1.55, 1.06], [f + 2.25, 1.55], [f + 2.95, 1.52], [r - 0.85, 1.28], [r - 0.55, 1.08]]
    : [[f + 1.5, 1.06], [f + 2.3, 1.66], [f + 3.15, 1.72], [r - 0.35, 1.26], [r - 0.12, 1.1]];
  add(body(cab, Wd - 0.22, 0.07), paint);
  // glass: side windows (a slightly wider, inset copy of the cabin profile), windscreen and rear window as tilted slabs
  const inset = cab.map(([z, y], i) => i === 0 ? [z + 0.2, y + 0.04] : i === cab.length - 1 ? [z - 0.2, y + 0.04] : [z + (i === 1 ? 0.18 : i === cab.length - 2 ? -0.22 : 0), y - 0.09]);
  add(body(inset, Wd - 0.17, 0.03), glass);
  const slab = (p0, p1, w) => { const [z0, y0] = p0, [z1, y1] = p1, len = Math.hypot(z1 - z0, y1 - y0), a = Math.atan2(y1 - y0, z1 - z0), nz = -Math.sin(a), ny = Math.cos(a);
    const m = add(new THREE.BoxGeometry(w, len * 0.92, 0.03), glass, 0, (y0 + y1) / 2 + ny * 0.04, (z0 + z1) / 2 + nz * 0.04); m.rotation.x = -(Math.PI / 2 - a) * -1 - Math.PI / 2 + Math.PI / 2; m.rotation.x = a - Math.PI / 2 + Math.PI; m.rotation.x = Math.PI / 2 - a; return m; };
  slab(cab[0], cab[1], Wd - 0.5); slab(cab[cab.length - 2], cab[cab.length - 1], Wd - 0.62);
  // dark lower skirt and diffuser
  add(new THREE.BoxGeometry(Wd - 0.1, 0.18, L - 0.5), dark, 0, 0.27, 0);
  // wheels: tyre, aero cover, brake hint
  const tyre = std(0x111214, { roughness: 0.9, metalness: 0 }), rim = std(0xb7bcc4, { roughness: 0.3, metalness: 0.8 }), cover = std(0x22252a, { roughness: 0.5, metalness: 0.3 }); g.userData.wheels = [];
  const wellM = std(0x0b0c0e, { roughness: 0.95, metalness: 0 });
  for (const z of [f + 0.92, r - 0.92]) for (const sx of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(sx * (Wd / 2 - 0.1), 0.39, z);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.28, 30), tyre); t.rotation.z = Math.PI / 2; const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.295, 26), rim); hub.rotation.z = Math.PI / 2;
    const cv = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.305, 26), cover); cv.rotation.z = Math.PI / 2; w.add(t, hub, cv); w.traverse(o => { o.castShadow = true; }); g.add(w); g.userData.wheels.push(w);
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.03, 30), wellM); well.rotation.z = Math.PI / 2; well.position.set(sx * (Wd / 2 - 0.005), 0.4, z); g.add(well);   // dark wheel arch on the body side
  }
  // lamps: full-width front light bar with two headlight slits, rear light bar, corner indicators (same interface as the other vehicles)
  g.userData.brake = []; g.userData.head = []; g.userData.blink = { L: [], R: [] };
  const lamp = (c, em, ei, w, h, d, x, y, z) => { const m = new THREE.MeshStandardMaterial({ color: c, emissive: em, emissiveIntensity: ei, roughness: 0.25 }); add(new THREE.BoxGeometry(w, h, d), m, x, y, z); return m; };
  g.userData.head.push(lamp(0xffffff, 0xfff4d6, 0.8, 0.62, 0.035, 0.05, -0.45, 0.82, f - 0.02), lamp(0xffffff, 0xfff4d6, 0.8, 0.62, 0.035, 0.05, 0.45, 0.82, f - 0.02));
  for (const sx of [-1, 1]) { g.userData.head.push(lamp(0xe8eef5, 0xdfe8ff, 0.5, 0.34, 0.07, 0.05, sx * 0.72, 0.62, f + 0.02)); }
  for (const sx of [-1, 1]) g.userData.brake.push(lamp(0x6e0d0d, 0xff1414, 0.12, 0.8, 0.06, 0.05, sx * 0.43, 0.93, r + 0.02));
  for (const [side, sx] of [['L', -1], ['R', 1]]) for (const zz of [f + 0.03, r - 0.02]) g.userData.blink[side].push(lamp(0x6a4300, 0xffa000, 0, 0.22, 0.06, 0.05, sx * (Wd / 2 - 0.2), zz === f + 0.03 ? 0.64 : 0.86, zz));
  // mirrors
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.2, 0.1, 0.12), paint, sx * (Wd / 2 + 0.02), 1.06, f + 1.5);
  g.userData.dims = { L, W: Wd, H: variant === 'sedan' ? 1.6 : 1.74 };
  g.userData.eye = [-0.5, 1.22, f + 1.55];       // behind the windscreen base: the cabin glass is see-through from inside
  return g;
}
