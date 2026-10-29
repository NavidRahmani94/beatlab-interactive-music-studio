const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await p.goto(process.argv[2]); await p.waitForTimeout(2000);
  await p.click('button.play >> nth=0'); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    const Tone = await import('/node_modules/.vite/deps/tone.js'); const raw = Tone.getContext().rawContext; window.__cap = []; window.__raw = raw;
    if (!raw.renderCapacity) { window.__nocap = true; return; }
    raw.renderCapacity.addEventListener('update', e => window.__cap.push([+e.averageLoad.toFixed(3), +e.peakLoad.toFixed(3), e.underrunRatio]));
    raw.renderCapacity.start({ updateInterval: 1 });
  });
  const count = async (proto) => { await cdp.send('HeapProfiler.collectGarbage'); const { result } = await cdp.send('Runtime.evaluate', { expression: proto + '.prototype' }); const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: result.objectId }); const x = await cdp.send('Runtime.callFunctionOn', { objectId: objects.objectId, functionDeclaration: 'function(){return this.length}', returnByValue: true }); return x.result.value; };
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(10000); const c = await p.evaluate(() => window.__nocap ? 'nocap' : window.__cap.slice(-10)); const avg = Array.isArray(c) ? (c.reduce((a, x) => a + x[0], 0) / c.length).toFixed(3) : c; console.log((i + 1) * 10 + 's', 'avgLoad', avg, 'osc alive', await count('OscillatorNode'), 'underrun', Array.isArray(c) ? c.at(-1)[2] : ''); }
  await b.close();
})();
