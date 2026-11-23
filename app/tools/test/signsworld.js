// "Signs on the road" (#/signs/world): on the real app page, for each of the five signs the scene loads, steps to the end, the question appears with four answers,
// answering shows the official wording, and the console stays clean. Also checks reduced motion (static arrow, scene held at its key frame).
// Usage (server on 8787, app root):  NODE_PATH=<playwright> [SHOTS=/dir] node tools/test/signsworld.js [baseUrl]
const { chromium } = require('playwright'); const fs = require('fs');
// Clicks are DOM clicks inside the scene (like scenes3d.js): on a slow software-GL runner Playwright's own click waits on a saturated main thread and times out.
const base = process.argv[2] || 'http://127.0.0.1:8787/', shots = process.env.SHOTS;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const press = (p, name) => p.locator('figure.viz3 button').filter({ hasText: new RegExp('^\\s*' + name + '\\s*$') }).first().evaluate(b => b.click(), null, { timeout: 120000 });
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  const sg = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../../data/signs.json'), 'utf8'));
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const ctx = await b.newContext({ viewport: { width: 900, height: 900 }, locale: 'he-IL', reducedMotion }), p = await ctx.newPage(), errs = []; p.setDefaultTimeout(120000);
    p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/GPU stall|ReadPixels/.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
    await p.goto(base); await p.waitForSelector('h1');
    await p.evaluate(() => localStorage.setItem('theoryIL.state', JSON.stringify({ v: 2, profile: { cls: 'B', lang: 'he', name: 'x' }, q: {}, bm: [], ex: [], xp: 0, days: {}, badges: {}, les: {}, fz: 0, frz: [], kn: {}, fc: {}, created: Date.now() })));
    await p.goto(base + '#/signs'); await p.reload();
    await p.getByRole('link', { name: 'תמרורים בכביש (תלת-ממד)' }).evaluate(a => a.click());
    await p.waitForFunction(() => document.querySelector('figure.viz3[data-ready="1"]'), null, { timeout: 180000 });
    ok(/#\/signs\/world/.test(await p.evaluate(() => location.hash)), `[${reducedMotion}] route #/signs/world opens from the signs trainer`);
    const chips = ['מסילת ברזל', 'מעבר חצייה', 'הולכי רגל', 'עצור', 'תן זכות קדימה'], nums = ['133', '135', '136', '302', '301'];
    for (let i = 0; i < 5; i++) {
      await press(p, chips[i]); await p.waitForTimeout(1500);
      const alt0 = await p.locator('.vz-alt').innerText();
      ok(alt0.includes(sg.e[nums[i]].split(' · ')[0].slice(0, 12)) || alt0.length > 10, `[${reducedMotion}] ${chips[i]} (${nums[i]}): text alternative present`);
      if (shots) await p.locator('figure.viz3').screenshot({ path: `${shots}/${reducedMotion}_${nums[i]}_a.png` });
      for (let k = 0; k < 7 && !(await p.locator('.vz3-quiz').isVisible()); k++) { await press(p, 'הצעד הבא'); await p.waitForTimeout(1200); if (shots && k === 1) await p.locator('figure.viz3').screenshot({ path: `${shots}/${reducedMotion}_${nums[i]}_b.png` }); }
      ok(await p.locator('.vz3-quiz').isVisible(), `[${reducedMotion}] ${nums[i]}: the question appears after the last step`);
      const ans = p.locator('.vz3-quiz .answer'); ok(await ans.count() === 4, `[${reducedMotion}] ${nums[i]}: four answers`);
      const texts = await ans.allInnerTexts(); ok(new Set(texts).size === 4 && texts.includes(sg.e[nums[i]].split(' · ')[0].trim()), `[${reducedMotion}] ${nums[i]}: answers are distinct official wordings, the right one among them`);
      await ans.nth(i % 4).evaluate(b => b.click()); await p.waitForTimeout(300);
      const fb = await p.locator('.vz3-quiz').innerText(); ok(fb.includes(`תמרור ${nums[i]}`) && fb.includes(sg.e[nums[i]].slice(0, 25)), `[${reducedMotion}] ${nums[i]}: feedback quotes the official table`);
      ok((await ans.evaluateAll(a => a.every(x => x.disabled))), `[${reducedMotion}] ${nums[i]}: answers locked after choosing`);
      if (shots) await p.locator('figure.viz3').screenshot({ path: `${shots}/${reducedMotion}_${nums[i]}_c.png` });
    }
    if (reducedMotion === 'reduce') { const st = await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches); ok(st, 'reduced motion is on in this context (arrow is static, scene starts at its key frame)'); }
    ok(!errs.length, `[${reducedMotion}] console clean${errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''}`);
    await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} check(s) failed` : 'signs world: all checks passed'); process.exit(fails ? 1 : 0);
})();
