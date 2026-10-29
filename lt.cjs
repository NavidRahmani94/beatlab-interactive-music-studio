const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await p.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ entryTypes: ['longtask'] }); });
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  for (const [tab, adv] of [['MELODY', false], ['MELODY', true], ['DRUMS', false]]) {
    await p.click(`button[role="tab"]:text-is("${tab}")`); await p.waitForTimeout(300);
    if (tab !== 'DRUMS') { const sec = 'section[aria-label="Melody track"]'; await p.click(`${sec} button:text-is("${adv ? 'ADVANCED' : 'EASY'}")`); }
    await p.waitForTimeout(500);
    await p.evaluate(() => (window.__lt = []));
    const t0 = await p.evaluate(() => Math.round(performance.now()));
    await p.click('button.play >> nth=0'); await p.waitForTimeout(25000);
    const lt = await p.evaluate(() => window.__lt);
    console.log(tab, adv ? 'ADV' : '', 'longtasks', lt.length, 'max', Math.max(0, ...lt.map(x => x[1])), 'ms; list(rel s,dur):', JSON.stringify(lt.slice(0, 14).map(x => [((x[0] - t0) / 1000).toFixed(1), x[1]])));
    await p.click('button.stop >> nth=0'); await p.waitForTimeout(800);
  }
  await b.close();
})();
