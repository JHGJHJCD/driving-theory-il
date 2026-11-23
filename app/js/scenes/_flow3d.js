// Small helpers shared by the step-through 3D scenes (accident, brakes, blowout, motojx, lamps, startcar, moto).
import { THREE, ease, reduced, shortest, btn, chipGroup, sfx } from '../kit3d.js';
import { h } from '../ui.js';

// objects that glide between poses {x, z, h, y?}; `place` can be replaced (e.g. to follow a slope)
export class Actors {
  constructor(C, place) { this.list = []; this.place = place || ((o, p) => { o.position.x = p.x; o.position.z = p.z; if (p.y != null) o.position.y = p.y; o.rotation.y = p.h; }); C.onFrame(dt => this.tick(dt)); }
  add(obj, pose) { const a = { obj, p: { h: 0, ...pose }, from: null, to: null, t: 1, dur: 1, moving: false, ease: ease }; this.place(obj, a.p); this.list.push(a); return a; }
  goto(map, dur = 2.4, instant = false) {          // map: array of [actor, partial pose]
    const touched = new Map(map);
    for (const a of this.list) { a.from = { ...a.p }; a.to = { ...a.p, ...(touched.get(a) || {}) }; const same = ['x', 'z', 'h', 'y'].every(k => a.from[k] === a.to[k]); a.t = instant || reduced() || same ? 1 : 0; a.dur = dur; a.moving = !same && a.t < 1; if (a.t === 1) { a.p = { ...a.to }; this.place(a.obj, a.p); } }
  }
  tick(dt) {
    for (const a of this.list) {
      if (a.t >= 1) { a.moving = false; continue; }
      a.t = Math.min(1, a.t + dt / a.dur); const k = a.ease(a.t), f = a.from, t = a.to;
      a.p = { x: f.x + (t.x - f.x) * k, z: f.z + (t.z - f.z) * k, h: f.h + shortest(f.h, t.h) * k, y: f.y != null && t.y != null ? f.y + (t.y - f.y) * k : t.y };
      a.moving = a.t < 1; this.place(a.obj, a.p);
    }
  }
}
export const face = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));   // heading that looks from -> to
export const walkAnim = a => a.obj.userData.play?.(a.moving ? 'walk' : 'idle');

// Next / Back / Again stepper; steps = array of captions; onShow(i, instant)
export function stepper({ ctl, say, steps, onShow, intro = '' }) {
  let i = 0;
  const n = steps.length;
  const show = (instant = false) => {
    say((intro ? intro + ' ' : '') + `צעד ${i + 1} מתוך ${n}: ${steps[i]}`);
    prev.disabled = i <= 0; next.disabled = i >= n - 1; if (next.disabled && document.activeElement === next) again.focus();
    onShow(i, instant);
  };
  const next = btn('הצעד הבא', () => { sfx.click(); i = Math.min(n - 1, i + 1); show(); }, 'btn small primary');
  const prev = btn('הצעד הקודם', () => { sfx.click(); i = Math.max(0, i - 1); show(); });
  const again = btn('מההתחלה', () => { sfx.click(); i = 0; show(true); });
  ctl.append(h('div', { class: 'row tight' }, next, prev, again));
  return { show, get i() { return i; } };
}

// camera chips: three / top / driver (driver only when `driver` is given)
export function camChips({ C, target, three = { yaw: 0.8, pitch: 0.5, dist: 34 }, top = { yaw: 0, pitch: 1.45, dist: 40 }, driver = null }) {
  const { view } = C, T = target.clone();
  Object.assign(view, three); view.target.copy(T);
  const items = [['three', 'מבט חצי'], ['top', 'מלמעלה']]; if (driver) items.push(['drv', 'מבט הנהג']);
  return chipGroup(items, 'three', k => {
    if (k === 'drv') { view.driver = driver; view.goal = null; return; }
    view.driver = null; view.goal = { ...(k === 'top' ? top : three), target: T.clone() };
  });
}

// both indicators blinking (hazard lights)
export function hazard(car, now, on) {
  const lit = on && Math.floor(now * 2.6) % 2 === 0;
  for (const side of ['L', 'R']) for (const m of car.userData.blink[side]) m.emissiveIntensity = lit ? 2.4 : 0;
}

// red warning triangle standing on the road; faces +Z (towards traffic coming from the south) when ry = 0
export function warningTriangle(W, x, z, ry = 0, s = 1) {
  const g = new THREE.Group();
  const tri = (r, y) => { const sh = new THREE.Shape(); sh.moveTo(0, r); sh.lineTo(-r * 0.87, -r * 0.5); sh.lineTo(r * 0.87, -r * 0.5); sh.closePath(); return sh; };
  const outer = tri(0.5), hole = tri(0.33); outer.holes.push(new THREE.Path(hole.getPoints()));
  const red = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.03, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xd8222a, roughness: 0.5, emissive: 0x330000 }));
  const inner = new THREE.Mesh(new THREE.ShapeGeometry(tri(0.33)), new THREE.MeshStandardMaterial({ color: 0xffe9e9, roughness: 0.6, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  inner.position.z = 0.015; red.castShadow = true; g.add(red, inner); g.children.forEach(c => { c.position.y = 0.33; }); g.scale.setScalar(s);
  g.position.set(x, 0, z); g.rotation.y = ry; W.scene.add(g); return g;
}

// translucent beam cone from a headlamp; returns the mesh (apex at the car, widening forwards along -Z)
export function beam(car, { len = 14, r = 3.2, color = 0xfff2c0, opacity = 0.16, x = 0 } = {}) {
  const L = car.userData.dims.L;
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, len, 28, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.rotation.x = Math.PI / 2; m.position.set(x, 0.75, -(L / 2 + len / 2)); m.userData.len = len; m.userData.L = L; car.add(m); return m;
}
export function setBeam(m, len, r, opacity) { m.geometry.dispose(); m.geometry = new THREE.ConeGeometry(r, len, 28, 1, true); m.position.z = -(m.userData.L / 2 + len / 2); m.material.opacity = opacity; }
