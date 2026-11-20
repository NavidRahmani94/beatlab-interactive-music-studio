const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage();
  await p.addInitScript(() => { window.__g = {}; window.__on = false; for (const k of ['createGain', 'createOscillator', 'createBufferSource', 'createConstantSource']) { const o = BaseAudioContext.prototype[k]; BaseAudioContext.prototype[k] = function () { if (window.__on) { const all = new Error().stack.split('\n').map(l => l.trim().replace(/\(http[^)]*\/([^/:?]+)[^)]*:(\d+):\d+\)/, '$1:$2').replace(/^at /, '')); const key = k + ' | ' + all.filter(l => !/tone\.js|standardized|^Error|createNative|^new (Gain|Audio|Oscillator|Constant|Buffer)Node|_Context\./.test(l)).slice(0, 5).join(' < '); window.__g[key] = (window.__g[key] || 0) + 1; } return o.apply(this, arguments); }; } });
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(1500);
  await p.click('button.play >> nth=0'); await p.waitForTimeout(6000);
  await p.evaluate(() => { window.__g = {}; window.__on = true; }); await p.waitForTimeout(20000); 
  const g = await p.evaluate(() => window.__g);
  Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(v, k.slice(0, 300)));
  await b.close();
})();
