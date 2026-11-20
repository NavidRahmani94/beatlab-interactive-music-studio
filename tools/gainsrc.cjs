const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.addInitScript(() => { window.__g = {}; window.__on = false; const o = BaseAudioContext.prototype.createGain; BaseAudioContext.prototype.createGain = function () { if (window.__on) { const all = new Error().stack.split('\n'); if (!/ToneConstantSource/.test(all.slice(2,12).join())) return o.apply(this, arguments); const st = all.slice(9, 18).map(l => l.trim().replace(/\(http[^)]*\/([^/:?]+)[^)]*:(\d+):\d+\)/, '$1:$2').replace(/^at /, '')).join(' < '); window.__g[st] = (window.__g[st] || 0) + 1; } return o.apply(this, arguments); }; });
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    const Tone = await import('/node_modules/.vite/deps/tone.js'); const { Rig } = await import('/rig.ts'); const { SAMPLE_PROJECTS } = await import('/project.ts');
    await Tone.start(); const pr = SAMPLE_PROJECTS['Hip Hop Demo'](); const rig = new Rig(); rig.setSynths(pr.synths); rig.setDrumKit(pr.drumKit); rig.setTracks(pr.tracks); rig.setChannels(pr.channels); await rig.ready();
    window.__on = true;
    for (let i = 0; i < 20; i++) { rig.triggerStep(i % 32, Tone.now() + 0.05, { name: 'x', drums: { kick: Array(32).fill(false), snare: Array(32).fill(false), hat: Array(32).fill(false), clap: Array(32).fill(false) }, notes: { synth: [{ step: i % 32, pitch: 'C4', lengthSteps: 1, velocity: 0.8 }] } }, i, 0.125); await new Promise(r => setTimeout(r, 40)); }
    window.__on = false;
  });
  const g = await p.evaluate(() => window.__g);
  Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([k, v]) => console.log(v, k.slice(0, 420)));
  await b.close();
})();
