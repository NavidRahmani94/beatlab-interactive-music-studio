const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await p.addInitScript(() => {
    window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push([Math.round(performance.now() / 1000), Math.round(e.duration)]))).observe({ entryTypes: ['longtask'] });
    window.__created = {}; for (const k of Object.getOwnPropertyNames(BaseAudioContext.prototype)) if (/^create/.test(k)) { const o = BaseAudioContext.prototype[k]; BaseAudioContext.prototype[k] = function (...a) { window.__created[k] = (window.__created[k] || 0) + 1; return o.apply(this, a); }; }
  });
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  await p.click('button.play >> nth=0');
  for (let i = 0; i < 8; i++) {
    await p.waitForTimeout(10000);
    const r = await p.evaluate(() => { gc && gc(); return { heapMB: +(performance.memory.usedJSHeapSize / 1e6).toFixed(1), created: JSON.stringify(window.__created), lt: window.__lt.length, ltMax: Math.max(0, ...window.__lt.map(x => x[1])), dom: document.getElementsByTagName('*').length }; });
    console.log((i + 1) * 10 + 's', r.heapMB + 'MB', 'dom', r.dom, 'longtasks', r.lt, 'max', r.ltMax, r.created);
  }
  await b.close();
})();
