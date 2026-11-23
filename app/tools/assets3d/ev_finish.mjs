import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune, quantize, flatten, join } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp'; import fs from 'fs';
const [,, rawGlb, infoJson, texDir, out, ratio = '0.1'] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(rawGlb); const info = JSON.parse(fs.readFileSync(infoJson));
await MeshoptSimplifier.ready;
const stat = () => { let t = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); t += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; } return Math.round(t); };
console.log('tris raw', stat());
await doc.transform(weld({ tolerance: 0.0005 }));
console.log('tris welded', stat());
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: +ratio, error: 0.02, lockBorder: false }));
console.log('tris simplified', stat());
const texCache = new Map();
for (const mat of doc.getRoot().listMaterials()) {
  const n = mat.getName(), inf = info[n] || {}; mat.setMetallicFactor(0.1).setRoughnessFactor(0.6);
  if (n === 'paint') { mat.setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0.6).setRoughnessFactor(0.3); continue; }
  if (inf.glass) { mat.setBaseColorFactor([0.02, 0.03, 0.04, Math.min(0.7, inf.opacity)]).setAlphaMode('BLEND').setMetallicFactor(0.6).setRoughnessFactor(0.05); continue; }
  const f = inf.file && `${texDir}/${inf.file}`; if (!f || !fs.existsSync(f)) { const c = inf.color || 0x888888; mat.setBaseColorFactor([((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, 1]); continue; }
  const meta = await sharp(f).metadata();
  if (meta.width <= 4) { const { data } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const lin = v => Math.pow(v / 255, 2.2); mat.setBaseColorFactor([lin(data[0]), lin(data[1]), lin(data[2]), 1]); continue; }
  if (!texCache.has(f)) { const png = await sharp(f).resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9, palette: false }).toBuffer(); texCache.set(f, doc.createTexture(inf.file).setImage(new Uint8Array(png)).setMimeType('image/png')); }
  mat.setBaseColorTexture(texCache.get(f)); mat.setBaseColorFactor([1, 1, 1, 1]);
  if (/rims|disc/.test(inf.file)) mat.setMetallicFactor(0.7).setRoughnessFactor(0.35); if (/tyre/.test(inf.file)) mat.setMetallicFactor(0).setRoughnessFactor(0.95);
  if (/vehiclelights/.test(inf.file)) mat.setEmissiveFactor([0, 0, 0]);
}
await doc.transform(dedup(), prune(), quantize());
await io.write(out, doc); console.log('written', out, fs.statSync(out).size, 'bytes, tris', stat());
