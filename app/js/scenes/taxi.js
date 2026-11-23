// A passenger boards a taxi (TR 501, 503, 510, 511). Captions copied from the 2D flow in viz.js.
import { THREE, LANE, label, reduced } from '../kit3d.js';
import { flowScene } from './_flow.js';

const STEPS = [
  ['"פנוי"\nמואר', 'מונית פנויה להסעת נוסעים בנסיעה מיוחדת: המונה במצב "פנוי" כשהוא מואר (511).'],
  ['לא\nמסרבים', 'מסיעים כל נוסע שמוכן לשלם, ולא מסרבים בלי סיבה סבירה – כולל חשש לביטחונך – להסיע נוסע ומטענו (501).'],
  ['מפעילים\nמונה', 'מפעילים את המונה עם העמדת המונית לרשות הנוסע, ומפסיקים בסיום הנסיעה (510(א)).'],
  ['הדרך\nהקצרה', 'נוסעים בדרך הקצרה ביותר האפשרית בנסיבות, ולא שוהים בדרך יותר מהדרוש (503(א)).'],
  ['בלי נוסע\nנוסף', 'לא מעלים נוסע נוסף על המזמין ומלוויו, אלא אם המזמין ביקש (501(ג)).']];

export default function taxi3d() {
  return flowScene({ title: 'נוסע עולה למונית: נסיעה מיוחדת', src: 'לפי תקנות 501, 503, 510, 511', steps: STEPS,
    cams: { three: { yaw: 1.0, pitch: 0.42, dist: 14 }, top: { yaw: 0, pitch: 1.45, dist: 18 } }, target: [3.5, 0.8, 0],
    setup({ C, W, tw, view }) {
      W.env({ ground: 'grass', size: 200, shadowSize: 50 });
      W.roadZ({ z0: -130, z1: 130, centre: 'dash' }); W.street({ z0: -130, z1: 130, xLeft: -14, xRight: 14, seed: 12 });
      const taxi = W.vehicle('taxi'), KX = 2.45; C.scene.add(taxi);
      // lit "available" sign on the roof and the meter state as floating labels
      const lamp = label('פנוי', { size: 0.55, bg: 'rgba(30,170,90,.95)' }); lamp.position.set(0, 2.6, 0); taxi.add(lamp);
      let meter = null; const setMeter = on => { if (meter) { taxi.remove(meter); meter.material.map?.dispose(); meter = null; } if (on) { meter = label('מונה פועל', { size: 0.5, bg: 'rgba(200,120,0,.95)' }); meter.position.set(0, 3.3, 0); taxi.add(meter); } };
      const mk = (i, x, z, ry, anim = 'idle') => { const p = W.person(i, { anim }); p.position.set(x, 0.16, z); p.rotation.y = ry; C.scene.add(p); return p; };
      const pax = mk(7, 5.6, -2.4, -Math.PI / 2), second = mk(2, 5.8, -3.6, -Math.PI / 2);
      const route = W.flat(LANE, -60, 1.3, 120, 0x2ecc71, { y: 0.07, opacity: 0.55, emissive: 0x2ecc71 }); route.visible = false;
      const bag = W.prop('people/item-luggage', { scale: 1.5, x: 5.0, z: -2.0 });
      const mkX = (x, y, z) => { const l = label('✕', { size: 0.9, bg: 'rgba(200,40,40,.95)' }); l.position.set(x, y, z); l.visible = false; C.scene.add(l); return l; };
      const cross = mkX(5.8, 3.0, -3.6);
      return {
        step(i, first) {
          if (first) { tw.clear(); taxi.visible = true; taxi.position.set(LANE, 0, 34); taxi.rotation.y = 0; W.setBrake(taxi, false); lamp.visible = true; setMeter(false); pax.visible = true; pax.position.set(5.6, 0.16, -2.4); bag.visible = true; second.visible = false; second.position.set(5.8, 0.16, -3.6); route.visible = false; cross.visible = false; pax.userData.play('idle'); }
          if (i === 0) { tw.move(taxi, { x: KX, z: 0 }, 3.2, { e: k => 1 - (1 - k) * (1 - k), end: () => W.setBrake(taxi, false) }); return { tag: [KX, 4.2, 0], look: [3.5, 0.8, 0] }; }
          if (i === 1) { W.setBrake(taxi, false); tw.walk(pax, 3.9, 0.3, { end: () => { pax.visible = false; bag.visible = false; } }); return { tag: [KX, 4.2, 0] }; }
          if (i === 2) { lamp.visible = false; setMeter(true); return { tag: [KX, 4.9, 0] }; }
          if (i === 3) { setMeter(true); route.visible = true; tw.move(taxi, { x: LANE, z: -26, ry: 0 }, 5, { e: k => k * k * (3 - 2 * k), delay: 0.2 }); return { tag: [LANE, 4.9, -10], look: [LANE + 1, 0.8, -12] }; }
          if (i === 4) { route.visible = false; setMeter(true); taxi.position.set(LANE, 0, 34); second.visible = true; second.userData.play('idle'); tw.move(taxi, { x: KX, z: 0 }, 3.2, { e: k => 1 - (1 - k) * (1 - k) });
            tw.add(0.1, () => {}, { delay: 3.2, end: () => { second.userData.play('emote-no'); cross.visible = true; } }); return { tag: [KX, 4.9, 0], look: [3.5, 0.8, 0] }; }
        },
      };
    } });
}
