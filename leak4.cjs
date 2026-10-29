const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext(); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  p.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(1500);
  const count = async (proto) => { await cdp.send('HeapProfiler.collectGarbage'); const { result } = await cdp.send('Runtime.evaluate', { expression: proto + '.prototype' }); const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: result.objectId }); const r = await cdp.send('Runtime.callFunctionOn', { objectId: objects.objectId, functionDeclaration: 'function(){return this.length}', returnByValue: true }); return r.result.value; };
  await p.evaluate(async () => {
    const Tone = await import('/node_modules/.vite/deps/tone.js'); const { Rig } = await import('/rig.ts'); const { SAMPLE_PROJECTS } = await import('/project.ts');
    await Tone.start(); window.__T = Tone;
    const pr = SAMPLE_PROJECTS['Hip Hop Demo'](); const rig = new Rig(); rig.setSynths(pr.synths); rig.setDrumKit(pr.drumKit); rig.setTracks(pr.tracks); rig.setChannels(pr.channels); await rig.ready();
    window.__rig = rig; window.__pr = pr;
  });
  const hit = (what) => p.evaluate(async (what) => {
    const rig = window.__rig, pr = window.__pr; const T = window.__T;
    for (let i = 0; i < 60; i++) {
      const t = T.now() + 0.05;
      if (what === 'kick' || what === 'snare' || what === 'hat' || what === 'clap') rig.playDrum(what, t, 1);
      else { const tr = pr.tracks.find(x => x.id === what); const notes = pr.patterns[1].notes[what] || pr.patterns[0].notes[what] || []; rig.triggerStep(i % 32, t, { name: 'x', drums: { kick: Array(32).fill(false), snare: Array(32).fill(false), hat: Array(32).fill(false), clap: Array(32).fill(false) }, notes: { [what]: [{ step: i % 32, pitch: 'C4', lengthSteps: 1, velocity: 0.8 }] } }, i, 0.125); }
      await new Promise(r => setTimeout(r, 40));
    }
    await new Promise(r => setTimeout(r, 3000));
  }, what);
  console.log('tracks', await p.evaluate(() => window.__pr.tracks.map(t => t.id + ':' + t.kind + ':' + t.instrument).join(' ')));
  for (const w of ['base', 'kick', ...(await p.evaluate(() => window.__pr.tracks.map(t => t.id)))]) {
    const before = await count('OscillatorNode'); const gb = await count('GainNode');
    if (w !== 'base') await hit(w);
    console.log(w.padEnd(8), 'osc +' + ((await count('OscillatorNode')) - before), 'gain +' + ((await count('GainNode')) - gb));
  }
  await b.close();
})();
