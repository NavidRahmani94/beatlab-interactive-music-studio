const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await p.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] }); });
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  for (const tab of ['DRUMS', 'MELODY']) {
    await p.click(`button[role="tab"]:text-is("${tab}")`);
    await p.evaluate(() => (window.__lt = []));
    await p.click('button.play >> nth=0'); await p.waitForTimeout(8000);
    const r = await p.evaluate(() => ({ lt: window.__lt, ctx: null }));
    console.log(tab, 'long tasks:', r.lt.length, 'max', Math.max(0, ...r.lt), 'ms', JSON.stringify(r.lt.slice(0, 20)));
    await p.click('button.play >> nth=0'); await p.waitForTimeout(500);
  }
  await b.close();
})();
