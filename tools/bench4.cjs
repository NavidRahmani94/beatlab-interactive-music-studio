const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
  p.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(2000);
  const out = await p.evaluate(async () => {
    const { Rig } = await import('/rig.ts'); const { renderProjectToWav } = await import('/exporter.ts'); const { SAMPLE_PROJECTS } = await import('/project.ts');
    const ready = Rig.prototype.ready; Rig.prototype.ready = async function () { await ready.call(this); if (window.__mut) window.__mut(this); };
    const run = async (label, mut, prMut) => {
      const pr = SAMPLE_PROJECTS['Hip Hop Demo'](); prMut && prMut(pr); window.__mut = mut || null;
      const t = performance.now(); const r = await renderProjectToWav(pr, 3, { mode: 'pattern', pattern: 1, format: 'wav16' });
      return { x_realtime: +(((performance.now() - t) / 1000) / r.seconds).toFixed(2) };
    };
    const res = {};
    res.baseline = await run('b');
    res.baseline2 = await run('b2');
    res.noMasterReverb = await run('nmr', rig => { rig.comp.disconnect(); rig.masterReverb.disconnect(); rig.comp.connect(rig.masterVol); });
    res.noSendReverbAndDelay = await run('nsr', rig => { rig.sendReverb.disconnect(); rig.delay.disconnect(); });
    res.noReverbsNoDelay = await run('nofx', rig => { rig.comp.disconnect(); rig.masterReverb.disconnect(); rig.comp.connect(rig.masterVol); rig.sendReverb.disconnect(); rig.delay.disconnect(); });
    res.noAmbientNotes = await run('na', null, pr => pr.patterns.forEach(pt => { delete pt.notes.ambient; }));
    res.noArp = await run('narp', null, pr => pr.patterns.forEach(pt => { delete pt.notes.arp; }));
    res.noMelody = await run('nm', null, pr => pr.patterns.forEach(pt => { delete pt.notes.melody; }));
    res.noSynthTrack = await run('ns', null, pr => pr.patterns.forEach(pt => { delete pt.notes.synth; }));
    res.drumsOnly = await run('d', null, pr => pr.patterns.forEach(pt => { pt.notes = {}; }));
    res.everythingSilent = await run('s', null, pr => pr.patterns.forEach(pt => { pt.notes = {}; ['kick', 'snare', 'hat', 'clap'].forEach(k => { pt.drums[k] = pt.drums[k].map(() => false); }); }));
    return res;
  });
  console.log(JSON.stringify(out)); await b.close();
})();
