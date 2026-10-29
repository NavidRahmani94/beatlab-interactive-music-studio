const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(2000);
  await p.click('button.play >> nth=0'); await p.waitForTimeout(25000);
  let chunks = []; cdp.on('HeapProfiler.addHeapSnapshotChunk', e => chunks.push(e.chunk));
  await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  fs.writeFileSync('/tmp/snap.json', chunks.join('')); await b.close();
})();
