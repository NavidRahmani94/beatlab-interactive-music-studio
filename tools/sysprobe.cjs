const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] }); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const cdp = await p.context().newCDPSession(p); await cdp.send('Performance.enable');
  await p.goto(process.argv[2]); await p.waitForTimeout(2000);
  const m = async () => { const r = await cdp.send('Performance.getMetrics'); const o = {}; r.metrics.forEach(x => o[x.name] = x.value); return o; };
  const mem = () => p.evaluate(() => ({ heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, rc: typeof (window.__ctx?.renderCapacity) }));
  const idle0 = await m(); await p.waitForTimeout(5000); const idle1 = await m();
  console.log('IDLE   main-thread busy %', (((idle1.TaskDuration - idle0.TaskDuration) / 5) * 100).toFixed(1), 'heap MB', (await mem()).heap);
  for (const [name, lite] of [['full', false], ['lite', true]]) {
    if (lite) await p.locator('button[aria-label="Lite mode"]').click();
    await p.locator('button.play').click(); await p.waitForTimeout(3000);
    const a = await m(); const t0 = Date.now(); await p.waitForTimeout(8000); const c = await m(); const dt = (Date.now() - t0) / 1000;
    console.log('PLAY', name, 'main-thread busy %', (((c.TaskDuration - a.TaskDuration) / dt) * 100).toFixed(1), 'script %', (((c.ScriptDuration - a.ScriptDuration) / dt) * 100).toFixed(1), 'layout+style %', ((((c.LayoutDuration - a.LayoutDuration) + (c.RecalcStyleDuration - a.RecalcStyleDuration)) / dt) * 100).toFixed(1), 'heap MB', (await mem()).heap, 'nodes', c.Nodes);
    await p.locator('button.stop').click(); await p.waitForTimeout(500);
  }
  const rc = await p.evaluate(async () => { const T = await import(performance.getEntriesByType('resource').map(r => r.name).find(n => /tone\.js|deps\/tone/.test(n)) || 'tone').catch(() => null); return null; });
  const rcinfo = await p.evaluate(() => { try { const c = new AudioContext(); const has = 'renderCapacity' in c; c.close(); return { has, ua: navigator.userAgent }; } catch (e) { return String(e); } });
  console.log(JSON.stringify(rcinfo)); await b.close();
})();
