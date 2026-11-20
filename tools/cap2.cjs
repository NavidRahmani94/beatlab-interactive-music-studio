const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(2000);
  await p.evaluate(async () => { window.__T = await import('/node_modules/.vite/deps/tone.js'); });
  await p.click('button.play >> nth=0'); await p.waitForTimeout(25000);
  const count = async (expr) => { await cdp.send('HeapProfiler.collectGarbage'); const { result } = await cdp.send('Runtime.evaluate', { expression: expr }); const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: result.objectId }); const x = await cdp.send('Runtime.callFunctionOn', { objectId: objects.objectId, functionDeclaration: 'function(){return this.length}', returnByValue: true }); return x.result.value; };
  for (const e of ['OscillatorNode.prototype', 'GainNode.prototype', 'window.__T.ToneOscillatorNode.prototype', 'window.__T.Oscillator.prototype', 'window.__T.FMOscillator.prototype', 'window.__T.AmplitudeEnvelope.prototype', 'window.__T.Synth.prototype', 'window.__T.MembraneSynth.prototype', 'window.__T.Gain.prototype', 'window.__T.Signal.prototype', 'window.__T.ToneBufferSource.prototype', 'window.__T.PolySynth.prototype', 'window.__T.Envelope.prototype']) console.log(e, await count(e));
  // are alive oscillators still playing? inspect state of Tone oscillator wrappers
  await b.close();
})();
