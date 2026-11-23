// Real-page check of the Content-Security-Policy: opens a lesson in 3D with the app's own index.html policy and fails on any console/page error
// (blob: texture fetches need connect-src blob:, the meshopt decoder needs 'wasm-unsafe-eval'). Usage (server on 8787, app root):
//   NODE_PATH=<playwright> node tools/test/csp3d.js [baseUrl]
const { chromium } = require('playwright');
(async () => {
  const base = process.argv[2] || 'http://127.0.0.1:8787/';
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'he-IL' })).newPage(), errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/GPU stall|ReadPixels/.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 220)); });
  await p.goto(base); await p.waitForSelector('h1');
  await p.evaluate(() => { localStorage.setItem('theoryIL.state', JSON.stringify({ v: 2, profile: { cls: 'B', lang: 'he', name: 'x' }, q: {}, bm: [], ex: [], xp: 0, days: {}, badges: {}, les: {}, fz: 0, frz: [], kn: {}, fc: {}, created: Date.now() })); localStorage.setItem('theory-il-viz-mode', '2d'); });
  await p.goto(base + '#/learn/priority/peek'); await p.reload();
  await p.getByRole('button', { name: 'הכול בעמוד אחד' }).first().click({ timeout: 60000 });
  const btn = p.getByRole('button', { name: 'תלת-ממד' }).first(); await btn.scrollIntoViewIfNeeded(); await btn.click();
  let ready = true; await p.waitForFunction(() => document.querySelector('figure.viz3[data-ready="1"]'), null, { timeout: 180000 }).catch(() => { ready = false; });
  await p.waitForTimeout(2500);
  const csp = await p.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
  const ok = ready && !errs.length && /connect-src[^;]*\bblob:/.test(csp) && /script-src[^;]*'wasm-unsafe-eval'/.test(csp) && !/unsafe-eval'(?!.*wasm)/.test(csp.replace(/'wasm-unsafe-eval'/g, ''));
  console.log(`${ok ? 'ok  ' : 'FAIL'} csp3d: scene ready ${ready}, errors ${errs.length}${errs.length ? '\n  ' + errs.slice(0, 5).join('\n  ') : ''}`);
  await b.close(); process.exit(ok ? 0 : 1);
})();
