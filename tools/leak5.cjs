const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext(); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const Tone = await import('/node_modules/.vite/deps/tone.js'); await import('/rig.ts'); await Tone.start();
    const P = Tone.ToneOscillatorNode.prototype; let created = 0, disposed = 0, ended = 0;
    const od = P.dispose; P.dispose = function () { disposed++; return od.call(this); };
    const os = P.start; P.start = function (...a) { created++; return os.apply(this, a); };
    const k = new Tone.MembraneSynth().toDestination();
    for (let i = 0; i < 20; i++) { k.triggerAttackRelease('C1', 0.1, Tone.now() + 0.02); await new Promise(r => setTimeout(r, 300)); }
    await new Promise(r => setTimeout(r, 2000));
    return { created, disposed };
  });
  console.log(JSON.stringify(r));
  const count = async (proto) => { await cdp.send('HeapProfiler.collectGarbage'); const { result } = await cdp.send('Runtime.evaluate', { expression: proto + '.prototype' }); const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: result.objectId }); const x = await cdp.send('Runtime.callFunctionOn', { objectId: objects.objectId, functionDeclaration: 'function(){return this.length}', returnByValue: true }); return x.result.value; };
  console.log('OscillatorNode alive', await count('OscillatorNode'));
  await b.close();
})();
