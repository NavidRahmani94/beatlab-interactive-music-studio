const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  await p.click('button.play >> nth=0');
  const count = async (proto) => {
    await cdp.send('HeapProfiler.collectGarbage');
    const { result } = await cdp.send('Runtime.evaluate', { expression: proto + '.prototype' });
    const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: result.objectId });
    const r = await cdp.send('Runtime.callFunctionOn', { objectId: objects.objectId, functionDeclaration: 'function(){return this.length}', returnByValue: true });
    return r.result.value;
  };
  for (let i = 0; i < 5; i++) {
    await p.waitForTimeout(i ? 12000 : 8000);
    const o = {}; for (const c of ['GainNode', 'OscillatorNode', 'AudioBufferSourceNode', 'ConstantSourceNode', 'BiquadFilterNode', 'DelayNode', 'WaveShaperNode', 'StereoPannerNode']) o[c] = await count(c);
    console.log(JSON.stringify(o));
  }
  await b.close();
})();
