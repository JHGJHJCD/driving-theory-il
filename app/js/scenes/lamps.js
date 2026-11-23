// When do the lights have to be on? Night, winter on intercity roads, tunnel, motorcycle, oncoming traffic – real models.
// Captions are those of the 2D flow in viz.js (TR 97, 99(א)).
import { THREE, fig3, sfx, LANE, label } from '../kit3d.js';
import { Actors, stepper, camChips, beam, setBeam } from './_flow3d.js';

const STEPS = [
  'בזמן תאורה (בלילה): פנסי חזית ופנסים אחוריים דולקים ולוחית הזיהוי האחורית מוארת (97(א)).',
  '1 בנובמבר עד 31 במרס, בדרך שאינה עירונית: פנסים דולקים גם ביום; מונית, אוטובוס ורכב מסחרי מעל 14,999 ק"ג – בכל דרך (97(ג)).',
  'מנהרה עם תמרור "מנהרה הדלק אורות": פנסים דולקים (97(ה)).',
  'אופנוע: תמיד עם פנסי חזית או פנסי נסיעת יום (97(ב)).',
  'רכב בא ממולך, עוצרים, או האור הגבוה מאיר את גב הרכב שלפניך: מעמעמים (99(א)).'];
const TAGS = ['זמן תאורה', 'נובמבר–מרס', 'מנהרה', 'אופנוע', 'רכב ממול'];
const MOODS = {
  night: { c: ['#070b18', '#1a2540', '#2a3350'], hemi: 0.5, hc: 0x5a6cae, sun: 0.3, sc: 0x8fa3ff, exp: 0.95 },
  day: { c: ['#5b9be0', '#a9cdf0', '#e4f0fa'], hemi: 1.05, hc: 0xdfeaff, sun: 2.4, sc: 0xfff3e0, exp: 1.05 },
  overcast: { c: ['#7d8896', '#a3adb9', '#c6ccd4'], hemi: 1.25, hc: 0xe6ecf4, sun: 0.6, sc: 0xdfe6ee, exp: 1.0 },
  tunnel: { c: ['#5b9be0', '#a9cdf0', '#e4f0fa'], hemi: 0.55, hc: 0xdfeaff, sun: 1.6, sc: 0xfff3e0, exp: 1.05 },
};
const skyTex = c => { const k = document.createElement('canvas'); k.width = 8; k.height = 256; const x = k.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, c[0]); g.addColorStop(.55, c[1]); g.addColorStop(1, c[2]); x.fillStyle = g; x.fillRect(0, 0, 8, 256); const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; return t; };

export default function lamps3d() {
  return fig3('מתי הפנסים דולקים?', 'לפי תקנות 97 ו־99(א)', ({ C, W, ctl, say }) => {
    const { scene, view } = C;
    W.env({ ground: 'grass', size: 240, shadowSize: 70 });
    const hemi = scene.children.find(o => o.isHemisphereLight), sun = W.sun, envTex = scene.environment;
    W.roadZ({ z0: -140, z1: 120, centre: 'dash' });
    const before = new Set(scene.children); W.street({ z0: -50, z1: 110, xLeft: -9.2, xRight: 9.2, seed: 21 });
    const urban = new THREE.Group(); scene.add(urban); for (const c of scene.children.filter(c => !before.has(c) && c !== urban)) urban.add(c);
    // tunnel on the road, z -62 … -122
    const TZ0 = -62, TZ1 = -122, tl = Math.abs(TZ1 - TZ0), tc = (TZ0 + TZ1) / 2, concrete = 0x8a8d93;
    const tunnel = new THREE.Group(); scene.add(tunnel);
    const tb = (w, h, d, x, y, z, col = concrete) => { const m = W.box(x, y, z, w, h, d, col, { roughness: 0.9 }); scene.remove(m); tunnel.add(m); return m; };
    tb(0.7, 7, tl, -8.3, 3.5, tc); tb(0.7, 7, tl, 8.3, 3.5, tc); tb(17.3, 0.9, tl, 0, 7.4, tc); tb(17.9, 1.5, 1.3, 0, 7.2, TZ0 + 0.2, 0x70737a);
    for (let z = TZ0 - 5; z > TZ1; z -= 7) for (const x of [-3.2, 3.2]) { const lm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 2.2), new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffe08a, emissiveIntensity: 2 })); lm.position.set(x, 6.85, z); tunnel.add(lm); }
    const tp = [[0, 4.8, TZ0 - 12], [0, 4.8, TZ0 - 32], [0, 4.8, TZ0 - 52]].map(p => { const l = new THREE.PointLight(0xffe2a0, 0, 30, 1.6); l.position.set(...p); tunnel.add(l); return l; });
    const tsign = label('מנהרה – הדלק אורות', { size: 1.5, bg: 'rgba(10,77,162,.95)' }); tsign.position.set(0, 9.6, TZ0 + 0.2); tunnel.add(tsign);
    // actors
    const me = W.vehicle('evsedan', { name: 'me' }), taxi = W.vehicle('taxi'), bus = W.vehicle('bus'), ahead = W.vehicle('ev'), onc = W.vehicle('taxi'), bike = W.moto({ riderIndex: 4 });
    scene.add(me, taxi, bus, ahead, onc, bike);
    const A = new Actors(C), a = A.add(me, { x: LANE, z: 40, h: 0 }), aT = A.add(taxi, { x: LANE, z: 200, h: 0 }), aB = A.add(bus, { x: LANE, z: 200, h: 0 }), aA = A.add(ahead, { x: LANE, z: 200, h: 0 }),
      aO = A.add(onc, { x: -LANE, z: -200, h: Math.PI }), aM = A.add(bike, { x: LANE, z: 200, h: 0 });
    // headlamps: cone of light for every vehicle, real spot lights for three of them (constant light count)
    const rig = new Map();
    for (const [v, spot] of [[me, true], [taxi, false], [bus, false], [ahead, false], [onc, true], [bike, true]]) {
      const b = beam(v, { len: 13, r: 4.2, opacity: 0 }), s = spot ? new THREE.SpotLight(0xfff0d0, 0, 55, 0.55, 0.6, 1.6) : null;
      if (s) { s.position.set(0, 0.8, -(v.userData.dims.L / 2)); const tg = new THREE.Object3D(); tg.position.set(0, 0, -22); v.add(tg); s.target = tg; v.add(s); }
      rig.set(v, { b, s });
    }
    const MODE = { off: [0, 0, 0, 0], day: [9, 3, 0.05, 0], low: [13, 4.2, 0.11, 520], high: [27, 7.5, 0.15, 1300] };
    const lights = (v, mode, tail = true) => { const r = rig.get(v), m = MODE[mode]; W.setHeadlights(v, mode !== 'off'); r.b.visible = mode !== 'off'; if (mode !== 'off') setBeam(r.b, m[0], m[1], m[2]); if (r.s) r.s.intensity = m[3];
      for (const q of v.userData.brake) q.emissiveIntensity = tail && mode !== 'off' ? 1.0 : 0.1; };
    const mood = k => { const M = MOODS[k]; scene.background?.dispose?.(); scene.background = skyTex(M.c); scene.fog.color.set(M.c[2]); hemi.intensity = M.hemi; hemi.color.setHex(M.hc); sun.intensity = M.sun; sun.color.setHex(M.sc); C.renderer.toneMappingExposure = M.exp; scene.environment = k === 'night' ? null : envTex; for (const l of tp) l.intensity = k === 'tunnel' ? 60 : 0; };
    let tag = null, cur = 0, dimmed = false;
    const setTag = (t, ok = true) => { if (tag) { me.remove(tag); tag.parent?.remove(tag); tag.material.map?.dispose(); } tag = label(t, { size: 1.25, bg: ok ? 'rgba(30,140,80,.95)' : 'rgba(80,90,110,.95)' }); tag.position.set(0, 3.5, 0); (cur === 3 ? bike : me).add(tag); };
    C.onFrame(() => { for (const w of bike.userData.wheels) w.rotation.x -= aM.moving ? 0.2 : 0;
      if (cur === 4 && !dimmed && me.position.z - onc.position.z < 62) { dimmed = true; lights(me, 'low'); lights(onc, 'low'); setTag('מעמעמים'); sfx.click(); } });
    const FOCUS = [[0.7, 0.45, 34, 0, 8], [0.7, 0.42, 38, 0, 5], [0.55, 0.38, 40, 0, -58], [0.75, 0.42, 26, 0, 10], [0.7, 0.4, 38, 0, 0]];
    const far = (aa, z) => aa.obj.position.z = z;
    const T = [
      () => { mood('night'); urban.visible = true; tunnel.visible = false; lights(me, 'low'); A.goto([[a, { x: LANE, z: 8 }]], 3.6); },
      () => { mood('overcast'); urban.visible = false; tunnel.visible = false; lights(me, 'day'); lights(taxi, 'day'); lights(bus, 'day'); a.p = { x: LANE, z: 40, h: 0 };
        A.goto([[a, { x: LANE, z: 6 }], [aT, { x: LANE, z: -16 }], [aB, { x: LANE, z: 28 }]], 4); },
      () => { mood('tunnel'); urban.visible = false; tunnel.visible = true; lights(me, 'low'); a.p = { x: LANE, z: 24, h: 0 }; A.goto([[a, { x: LANE, z: -84 }]], 6.5); },
      () => { mood('day'); urban.visible = true; tunnel.visible = false; lights(bike, 'day'); A.goto([[aM, { x: LANE, z: -4 }]], 3.6); },
      () => { mood('night'); urban.visible = true; tunnel.visible = false; dimmed = false; lights(me, 'high'); lights(onc, 'high'); lights(ahead, 'low'); a.p = { x: LANE, z: 30, h: 0 };
        A.goto([[a, { x: LANE, z: -6 }], [aO, { x: -LANE, z: 24 }], [aA, { x: LANE, z: -34 }]], 7); },
    ];
    const parkAll = () => { for (const [ac, z] of [[a, 200], [aT, 200], [aB, 200], [aA, 200], [aO, -200], [aM, 200]]) { ac.p = { ...ac.p, z }; ac.obj.position.z = z; ac.t = 1; } for (const v of rig.keys()) lights(v, 'off'); };
    const camSel = camChips({ C, target: new THREE.Vector3(0, 0, 8), three: { yaw: 0.7, pitch: 0.45, dist: 34 }, top: { yaw: 0, pitch: 1.45, dist: 44 }, driver: me });
    const st = stepper({ ctl, say, steps: STEPS, onShow: (i, instant) => { cur = i; parkAll(); const f = FOCUS[i]; setTag(TAGS[i]); a.t = 1; T[i]();
      if (instant && false) {} if (!view.driver) view.goal = { yaw: f[0], pitch: f[1], dist: f[2], target: new THREE.Vector3(f[3], 0, f[4]) }; } });
    ctl.append(camSel); st.show(true);
  });
}
