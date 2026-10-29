const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const mode of ['all', 'drumsOnly', 'noHat', 'noKick', 'tracksOnly']) {
    const ctx = await b.newContext(); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await p.addInitScript(m => {
      // strip parts of the startup project through localStorage autosave is complex; instead patch Array.prototype? -> use query param handled below
      window.__mode = m;
    }, mode);
    await p.goto(process.argv[2] + '?x=' + mode); await p.waitForTimeout(1200);
    // mute channels through UI is complex: instead disable instruments by patching Tone prototypes
    await p.evaluate(m => {
      const T = window.__tone; // not exposed
    }, mode);
    await b.close(); return;
  }
})();
