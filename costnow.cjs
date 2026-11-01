const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto(process.argv[2]); await p.waitForTimeout(1000);
  const out = await p.evaluate(async () => {
    const { renderProjectToWav } = await import('/exporter.ts'); const { SAMPLE_PROJECTS } = await import('/project.ts'); const { addFx, FX_IDS } = await import('/fx.ts');
    const base = () => { const pr = SAMPLE_PROJECTS['Hip Hop Demo'](); pr.playlist = [0]; return pr; };
    const time = async (pr) => { const t = performance.now(); const r = await renderProjectToWav(pr, 4, { mode: 'pattern', pattern: 0, format: 'wav16' }); return { ms: performance.now() - t, sec: r.seconds }; };
    const variants = {
      'everything (as shipped)': pr => pr,
      'no reverb (master + sends)': pr => { pr.master = { ...pr.master, reverbMix: 0 }; Object.keys(pr.channels).forEach(k => pr.channels[k] = { ...pr.channels[k], reverbSend: 0 }); return pr; },
      'no delay sends': pr => { Object.keys(pr.channels).forEach(k => pr.channels[k] = { ...pr.channels[k], delaySend: 0 }); return pr; },
      'drums muted': pr => { ['kick', 'snare', 'hat', 'clap'].forEach(k => pr.channels[k] = { ...pr.channels[k], muted: true }); return pr; },
      'melodic tracks muted': pr => { pr.tracks.forEach(t => pr.channels[t.id] = { ...pr.channels[t.id], muted: true }); return pr; },
      'compressor + EQ off': pr => { pr.master = { ...pr.master, compAmount: 0, eqLow: 0, eqMid: 0, eqHigh: 0 }; return pr; },
      '+ 4 effects on every track': pr => { pr.tracks.forEach(t => { let l; ['chorus', 'phaser', 'distortion', 'autofilter'].forEach(x => l = addFx(l, x)); pr.channels[t.id] = { ...pr.channels[t.id], fx: l }; }); return pr; }
    };
    const res = {}; await time(base());
    for (const [k, f] of Object.entries(variants)) { const r = []; for (let i = 0; i < 2; i++) r.push(await time(f(base()))); res[k] = { ms: Math.round(Math.min(...r.map(x => x.ms))), sec: r[0].sec }; }
    return res;
  });
  const base = out['everything (as shipped)'];
  console.log('audio seconds rendered:', base.sec.toFixed(1));
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(32), String(v.ms).padStart(6), 'ms', ' =', (v.ms / 1000 / v.sec * 100).toFixed(1) + '% of real time', ' (' + (v.ms / base.ms * 100).toFixed(0) + '% of baseline)');
  await b.close();
})();
