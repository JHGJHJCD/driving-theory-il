// Shared by the junction scenes (priority, leftturn): a real 4-way junction – road along Z crossing a road along X, nothing painted inside the box,
// pavements with corners, houses and trees around it (the camera is kept out of them through view.avoid).
// Lane centres: vertical road (north = -Z): two-way northbound x = +LANE_W*(k+.5), southbound the mirror; one-way: n lanes centred on x=0, k=0 is the leftmost.
// Horizontal road (west = -X): westbound on the north side z = -LANE_W*(k+.5), eastbound +; one-way westbound: k=0 (leftmost) is the south-most lane.
import { LANE_W, THREE } from '../kit3d.js';

export function junction(C, W, { v = { one: false, n: 1 }, hz = { one: false, n: 1 }, L = 90, P = 4, houses = true } = {}) {
  const scene = C.scene, before = scene.children.length;
  const wv = (v.one ? 1 : 2) * v.n * LANE_W, wh = (hz.one ? 1 : 2) * hz.n * LANE_W, hv = wv / 2, hh = wh / 2;
  W.asphalt(0, 0, wv, 2 * L, { y: 0.012 }); W.asphalt(0, 0, 2 * L, wh, { y: 0.02 });
  const segZ = f => { f(-L, -hh); f(hh, L); }, segX = f => { f(-L, -hv); f(hv, L); };
  // --- vertical road markings (outside the box)
  segZ((a, b) => {
    W.line(-hv + 0.25, a, b); W.line(hv - 0.25, a, b);
    if (v.one) for (let k = 0; k < v.n - 1; k++) W.dashes((k + 0.5 - (v.n - 1) / 2) * LANE_W, a, b);
    else { for (let k = 1; k < v.n; k++) for (const s of [-1, 1]) W.dashes(s * k * LANE_W, a, b); if (v.n === 1) W.dashes(0, a, b); else W.line(0, a, b); }
  });
  // --- horizontal road markings
  segX((a, b) => {
    W.lineX(-hh + 0.25, a, b); W.lineX(hh - 0.25, a, b);
    if (hz.one) for (let k = 0; k < hz.n - 1; k++) W.dashesX(((hz.n - 1) / 2 - k - 0.5) * LANE_W, a, b);
    else { for (let k = 1; k < hz.n; k++) for (const s of [-1, 1]) W.dashesX(s * k * LANE_W, a, b); if (hz.n === 1) W.dashesX(0, a, b); else W.lineX(0, a, b); }
  });
  // --- pavements: horizontal strips run up to the vertical road's edge, vertical strips start beyond the horizontal strips (no overlap, no z-fighting)
  for (const sz of [-1, 1]) { W.kerb(-(L + hv) / 2, sz * (hh + P / 2), L - hv, P); W.kerb((L + hv) / 2, sz * (hh + P / 2), L - hv, P); }
  for (const sx of [-1, 1]) { const len = L - hh - P; W.kerb(sx * (hv + P / 2), -(hh + P + len / 2), P, len); W.kerb(sx * (hv + P / 2), hh + P + len / 2, P, len); }
  const avoid = []; C.view.avoid = avoid;
  if (houses) {
    const H = ['city/building-type-a', 'city/building-type-b', 'city/building-type-c', 'city/building-type-d', 'city/building-type-e', 'city/building-type-f', 'city/building-type-g', 'city/building-type-h'];
    let n = 0; const put = (x, z, big = false) => { W.prop(big ? 'shops/building-' + 'abcdefgh'[n % 8] : H[n % H.length], { scale: big ? 10 : 9, x, z, ry: Math.atan2(-x, -z) }); avoid.push({ x, z, r: 11, h: 28 }); n++; };
    const off = P + 15;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(sx * (hv + off), sz * (hh + off), (sx + sz) % 2 === 0);
    for (const s of [-1, 1]) { put(s * (hv + off), s * 46); put(-s * (hv + off), s * 46 + 3, true); put(s * 46, -s * (hh + off)); put(s * 46 + 3, s * (hh + off)); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { W.prop('city/tree-large', { scale: 9, x: sx * (hv + P + 1.5), z: sz * (hh + P + 1.5) }); }
    for (let t = 22; t < L; t += 16) for (const s of [-1, 1]) for (const o of [-1, 1]) {
      W.prop('city/tree-small', { scale: 9, x: o * (hv + 1.5 + (o > 0 ? 0 : 0)), z: s * t });
      W.prop('city/tree-small', { scale: 9, x: s * t, z: o * (hh + 1.5) });
    }
  }
  const made = scene.children.slice(before);     // only what this junction added (cars, arrows etc. added later are not removed)
  const lane = {
    v: (kind, k = 0) => v.one ? (k - (v.n - 1) / 2) * LANE_W : (kind === 'sb' ? -1 : 1) * LANE_W * (k + 0.5),
    h: (kind, k = 0) => hz.one ? ((hz.n - 1) / 2 - k) * LANE_W : (kind === 'eb' ? 1 : -1) * LANE_W * (k + 0.5),
  };
  const dispose = () => { for (const o of made) { scene.remove(o); o.traverse(m => { if (m.userData?.shared) return; m.geometry?.dispose?.(); for (const x of [].concat(m.material || [])) { if (x.userData?.shared) continue; x.map?.dispose?.(); x.dispose?.(); } }); } avoid.length = 0; };
  return { wv, wh, hv, hh, lane, dispose, avoid, L };
}

// "where the car waits": z of the car centre so its nose is `gap` m before the junction edge (car length l)
export const waitZ = (J, l, gap = 1.2) => J.hh + gap + l / 2;
export { THREE };
