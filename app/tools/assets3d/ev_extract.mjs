// FBX (Tesla Model 3 2018, supplied by the project owner) -> small web GLB: exterior only, logos removed, decimated, textures re-attached.
// usage: node tesla.mjs <dir with source/tesla_car1.fbx and textures/> <out.glb>   (needs three.js + FBXLoader/GLTFExporter shims in the same folder and @gltf-transform + meshoptimizer installed)
globalThis.window = { URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} } }; globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
globalThis.FileReader = class { readAsArrayBuffer(b) { b.arrayBuffer().then(r => { this.result = r; this.onloadend?.(); this.onload?.({ target: this }); }); } readAsDataURL(b) { b.arrayBuffer().then(r => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(r).toString('base64'); this.onloadend?.(); this.onload?.({ target: this }); }); } };
import fs from 'fs'; import * as THREE from './three.js';
const { FBXLoader } = await import('./FBXLoader.js'); const { GLTFExporter } = await import('./GLTFExporter.js');
const [,, dir, out] = process.argv;
const buf = fs.readFileSync(dir + '/source/tesla_car1.fbx'); const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
// interior, mechanical parts, brand marks and empty placeholders are dropped (the scenes only show the outside)
const DROP = /^(Seat_Leather_white|Leather_white|texture_Leather|texture_Leather001|whiteleather|Carpet|Carpet_Light|Putih|Putih001|Putih002|movsteer_10|dvorright|dvorleft|LCDs|belt|chromeBELT|mirror_inside|texture_Buttons|aluminium|aluminium2|black|black001|black002|black003|black004|black005|hitam001|hitam002|hitam003|hitam005|hitam006|suspensi|suspensi2|satin_red|interiorlights|paint_black|chassis|cahrome|chrome_|Plastic|chrome_bonnet_ok|chrome001|chrome2|chrome1|door_lf_ok|door_rf_ok|door_lr_ok|door_rr_ok|texture_Leather|base)$/;
const drop = []; root.traverse(o => { if (o.isMesh && DROP.test(o.name)) drop.push(o); }); drop.forEach(o => o.parent.remove(o));
const info = {}; const GLASS = /glass|tembus/i, PAINT = /^primary/;
root.traverse(o => { if (!o.isMesh) return; o.material = [].concat(o.material).map(m => { const n = PAINT.test(m.name) ? 'paint' : m.name; const file = m.map?.userData?.file || ''; info[n] ||= { file, color: m.color.getHex(), opacity: m.opacity, glass: GLASS.test(m.name) };
  const s = new THREE.MeshStandardMaterial({ color: n === 'paint' ? 0xffffff : 0xffffff, name: n }); return s; }); if (o.material.length === 1) o.material = o.material[0]; });
const merged = {}; root.traverse(o => { if (o.isMesh) { for (const m of [].concat(o.material)) merged[m.name] ||= m; if (Array.isArray(o.material)) o.material = o.material.map(m => merged[m.name]); else o.material = merged[o.material.name]; } });
let tris = 0; root.traverse(o => { if (o.isMesh) tris += o.geometry.attributes.position.count / 3; }); console.log('kept triangles before simplification', Math.round(tris));
const buf2 = await new Promise((ok, no) => new GLTFExporter().parse(root, ok, no, { binary: true }));
fs.writeFileSync('/tmp/claude-0/conv/_m3_raw.glb', Buffer.from(buf2)); fs.writeFileSync('/tmp/claude-0/conv/_m3_info.json', JSON.stringify(info, null, 1)); console.log('materials', Object.keys(info).length, 'raw bytes', buf2.byteLength);
