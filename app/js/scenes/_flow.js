// Shared stepper for the 3D versions of the step-through "flow" diagrams (viz.js flow()).
// A scene gives: title, source line, intro, steps [[short label, caption]] copied from viz.js, and setup(ctx) -> { step(i, instant), cams?, target?, driver? }.
// step(i) returns optionally { tag: [x,y,z] } (where the short label floats) and { look: [x,y,z] } (new camera target).
import { THREE, fig3, chipGroup, btn, sfx, reduced, ease, shortest, label } from '../kit3d.js';
import { h } from '../ui.js';

export function flowScene({ title, src, steps, intro = '', setup, cams: camDefs, target = [0, 0.8, 0], tagSize = 1.1 }) {
  return fig3(title, src, ({ C, W, ctl, say }) => {
    const view = C.view, tweens = [];
    const tw = {
      // fn(k) runs for dur seconds with k = eased 0..1; start()/end() hooks; in reduced motion everything jumps to the end
      add(dur, fn, { delay = 0, start, end, e = ease } = {}) { if (reduced()) { start?.(); fn(1); end?.(); return; } tweens.push({ t: -delay, dur, fn, e, start, end, started: false }); },
      move(obj, to, dur, o = {}) { const f = { x: obj.position.x, y: obj.position.y, z: obj.position.z, ry: obj.rotation.y }, dry = 'ry' in to ? shortest(f.ry, to.ry) : 0;
        this.add(dur, k => { for (const a of ['x', 'y', 'z']) if (a in to) obj.position[a] = f[a] + (to[a] - f[a]) * k; if ('ry' in to) obj.rotation.y = f.ry + dry * k; }, { e: k => k, ...o }); },
      // a person walks to (x,z): faces the way, plays 'walk', then 'idle' (and turns to ry2 if given)
      walk(p, x, z, { speed = 1.5, ry2, delay = 0, end } = {}) { const d = Math.hypot(x - p.position.x, z - p.position.z), face = Math.atan2(x - p.position.x, z - p.position.z);
        if (reduced() || d < 0.01) { p.position.x = x; p.position.z = z; if (ry2 !== undefined) p.rotation.y = ry2; else if (d > 0.01) p.rotation.y = face; p.userData.play('idle'); end?.(); return; }
        p.rotation.y = face; this.move(p, { x, z }, d / speed, { delay, start: () => p.userData.play('walk'), end: () => { p.userData.play('idle'); if (ry2 !== undefined) p.rotation.y = ry2; end?.(); } }); },
      clear() { tweens.length = 0; },
    };
    C.onFrame(dt => { for (let j = tweens.length - 1; j >= 0; j--) { const t = tweens[j]; t.t += dt; if (t.t < 0) continue; if (!t.started) { t.started = true; t.start?.(); } const k = Math.min(1, t.t / t.dur); t.fn(t.e(k)); if (k >= 1) { tweens.splice(j, 1); t.end?.(); } } });
    const S = setup({ C, W, tw, view, say });
    const camSet = { three: { yaw: 0.9, pitch: 0.5, dist: 22 }, top: { yaw: 0, pitch: 1.45, dist: 24 }, ...(S.cams || camDefs || {}) };
    const base3 = { ...camSet.three }; let cam = 'three', i = 0, tag = null, T = new THREE.Vector3(...(S.target || target));
    const setCam = (k, instant) => { cam = k; if (k === 'drv') { view.driver = S.driver; view.goal = null; return; } view.driver = null; const g = { ...camSet[k], target: T.clone() }; if (instant) { Object.assign(view, g); view.target.copy(T); view.goal = null; } else view.goal = g; };
    Object.assign(view, camSet.three); view.target.copy(T);
    const n = steps.length;
    const show = () => {
      const r = S.step(i, i === 0) || {}; camSet.three = { ...base3, ...(r.view || {}) }; if (r.view && cam === 'three') setCam('three'); if (r.look) { T = new THREE.Vector3(...r.look); if (cam !== 'drv') setCam(cam); }
      if (tag) { C.scene.remove(tag); tag.material.map?.dispose(); tag.material.dispose(); tag = null; }
      if (r.tag) { tag = label(`${i + 1} · ${steps[i][0].replace('\n', ' ')}`, { size: tagSize, bg: 'rgba(20,90,70,.93)' }); tag.position.set(...r.tag); C.scene.add(tag); }
      say((intro ? intro + ' ' : '') + `צעד ${i + 1} מתוך ${n}: ${steps[i][1]}`);
      nextB.disabled = i >= n - 1; if (nextB.disabled && document.activeElement === nextB) againB.focus();
    };
    const nextB = btn('הצעד הבא', () => { sfx.click(); i++; show(); }, 'btn small primary'), againB = btn('מההתחלה', () => { sfx.click(); i = 0; tw.clear(); show(); });
    const items = [['three', 'מבט חצי'], ['top', 'מלמעלה'], ...(S.driver ? [['drv', 'מבט הנהג']] : []), ...(S.extraCams || [])];
    ctl.append(h('div', { class: 'row tight' }, nextB, againB), chipGroup(items, 'three', k => setCam(k)));
    C.onFrame((dt, now) => { if (tag) tag.position.y += Math.sin(now * 2.2) * 0.0015; S.frame?.(dt, now); });
    show(); W.whenReady(() => { if (i === 0) show(); });
    return S;
  });
}
