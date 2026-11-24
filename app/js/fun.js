// The fun layer of the app screens (home, practice, results): confetti, varied praise, a friendly mascot line.
// Pure helpers, no state. The caller checks the 'fun' switch (profile.fun !== false); with reduced motion nothing flies.
import { h } from './ui.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#f5b301', '#e94d8a', '#3aa0ff', '#2fb36b', '#ff7a45', '#8a5cf6'];
const pickOf = a => a[Math.floor(Math.random() * a.length)];

/** a short full-screen burst of confetti; removes itself */
export function burst(n = 44) {
  if (calm()) return;
  const host = h('div', { class: 'burst', 'aria-hidden': 'true' }, Array.from({ length: n }, (_, i) => h('i', { style: {
    '--x': (Math.random() * 100).toFixed(1) + 'vw', '--dx': (Math.random() * 160 - 80).toFixed(0) + 'px', '--d': (Math.random() * 0.5).toFixed(2) + 's',
    '--t': (1.6 + Math.random() * 1.2).toFixed(2) + 's', '--r': Math.round(Math.random() * 720 - 360) + 'deg', '--c': COLORS[i % COLORS.length] } })));
  document.body.append(host); setTimeout(() => host.remove(), 3400);
}
/** random line from a list (the i18n arrays) */
export const line = list => (Array.isArray(list) && list.length ? pickOf(list) : '');

/** morning / noon / evening / night bucket for the greeting */
export function daypart(d = new Date()) { const hr = d.getHours(); return hr < 5 ? 'night' : hr < 12 ? 'morning' : hr < 18 ? 'noon' : 'evening'; }

/** the mascot: a little car with a speech bubble */
export function mascot(text) {
  return h('div', { class: 'mascot' }, h('span', { class: 'mcar', 'aria-hidden': 'true', text: '🚗' }), h('p', { class: 'mbubble', text }));
}
