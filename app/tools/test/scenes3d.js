// Smoke test for every 3D lesson scene: loads it, waits for the models, checks there are no page errors, frames are drawn, the canvas is not blank,
// and that clicking through every button of the scene (steps, chips, camera) causes no error. Usage:
//   python3 -m http.server 8787 --bind 127.0.0.1 &   (from app/)   then   node tools/test/scenes3d.js [key ...]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const base = process.env.BASE || 'http://127.0.0.1:8787/';
const keys = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(__dirname, '../../js/scenes')).filter(f => f.endsWith('.js') && !f.startsWith('_')).map(f => f.slice(0, -3)).sort();
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let fail = 0;
  for (const k of keys) {
    const p = await b.newPage({ viewport: { width: 1100, height: 900 } }), errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    p.on('requestfailed', r => errs.push('request failed ' + r.url().slice(-60)));
    try {
      await p.goto(`${base}tools/assets3d/scene.html?k=${k}`);
      await p.waitForFunction(() => document.title === 'done', null, { timeout: 120000 });
      await p.waitForTimeout(1500);
      const info = await p.evaluate(() => { const C = window.__node._C; return { frames: C.frames, kids: (() => { let n = 0; C.scene.traverse(o => { if (o.isMesh) n++; }); return n; })(), title: window.__node.getAttribute('aria-label') }; });
      const png = await p.locator('canvas').first().screenshot(); const seen = new Set(); for (let i = 5000; i < png.length; i += 997) seen.add(png[i] >> 3);
      const total = await p.locator('figure button').count(); let clicked = 0;
      for (let i = 0; i < Math.min(total, 16); i++) { const bt = p.locator('figure button').nth(i); try { if (await bt.isDisabled()) continue; await bt.click({ timeout: 20000 }); clicked++; await p.waitForTimeout(300); } catch (e) { errs.push('click ' + i + ': ' + e.message.split('\n')[0].slice(0, 80)); } }
      await p.waitForTimeout(800);
      const ok = !errs.length && info.frames > 1 && info.kids > 15 && seen.size > 12;
      if (!ok) fail++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${k}: frames ${info.frames}, meshes ${info.kids}, tones ${seen.size}, buttons clicked ${clicked}${errs.length ? ', errors: ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
    } catch (e) { fail++; console.log(`FAIL ${k}: ${e.message.split('\n')[0]}`); }
    await p.close();
  }
  await b.close(); console.log(fail ? `${fail} scene(s) failed` : 'all 3D scenes passed'); process.exit(fail ? 1 : 0);
})();
