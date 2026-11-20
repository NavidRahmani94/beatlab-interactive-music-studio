const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  await cdp.send('Performance.enable'); const css = process.argv[4]; if (css) await p.addStyleTag({ content: css });
  await p.click('button[role="tab"]:text-is("MELODY")'); await p.click('section[aria-label="Melody track"] button:text-is("ADVANCED")'); await p.waitForTimeout(500);
  await p.click('button.play >> nth=0'); await p.waitForTimeout(3000);
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const a = await m(); await p.waitForTimeout(15000); const c = await m();
  console.log(process.argv[3], 'script s/15s', (c.ScriptDuration - a.ScriptDuration).toFixed(2), 'layout', (c.LayoutDuration - a.LayoutDuration).toFixed(2), 'recalcStyle', (c.RecalcStyleDuration - a.RecalcStyleDuration).toFixed(2), 'task', (c.TaskDuration - a.TaskDuration).toFixed(2));
  await b.close();
})();
