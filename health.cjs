const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  if (process.argv[3]) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.argv[3]) });
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  await p.click('button.play >> nth=0'); await p.waitForTimeout(15000);
  console.log(await p.textContent('.viz .panel-label'));
  await b.close();
})();
