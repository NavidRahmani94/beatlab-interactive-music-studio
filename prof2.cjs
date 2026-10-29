const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  if (process.argv[3] === 'adv') { await p.click('button[role="tab"]:text-is("MELODY")'); await p.click('section[aria-label="Melody track"] button:text-is("ADVANCED")'); }
  await p.click('button.play >> nth=0'); await p.waitForTimeout(3000);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
  await p.waitForTimeout(30000);
  const { profile } = await cdp.send('Profiler.stop');
  const nodes = new Map(profile.nodes.map(n => [n.id, n])); const self = new Map(); const dt = profile.timeDeltas; let total = 0;
  profile.samples.forEach((id, i) => { const n = nodes.get(id); const k = n.callFrame.functionName + ' ' + (n.callFrame.url.split('/').pop() || '') + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + dt[i]); total += dt[i]; });
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
  console.log('total ms', Math.round(total / 1000)); top.forEach(([k, v]) => console.log((v / 1000).toFixed(0).padStart(6), 'ms', k));
  // gc stats
  await b.close();
})();
