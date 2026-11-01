const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
  p.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(2000);
  const out = await p.evaluate(async () => {
    const Tone = await import('/node_modules/.vite/deps/tone.js');
    const { Rig } = await import('/rig.ts'); const { SAMPLE_PROJECTS } = await import('/project.ts'); const { frameAt } = await import('/song.ts');
    const base = () => SAMPLE_PROJECTS['Hip Hop Demo']();
    const run = async (label, mutate, prMut) => {
      const pr = base(); prMut && prMut(pr);
      const step = 60 / pr.bpm / 4; const total = 32 * 4; const seconds = total * step + 3;
      const t = performance.now();
      await Tone.Offline(async ({ transport }) => {
        const rig = new Rig(); rig.setSynths(pr.synths); rig.setDrumKit(pr.drumKit); rig.setGroove(pr.groove); rig.setTracks(pr.tracks); rig.setMaster(pr.master); rig.setChannels(pr.channels); rig.setTempo(pr.bpm);
        await rig.ready(); mutate && mutate(rig, Tone);
        let c = 0; transport.bpm.value = pr.bpm;
        transport.scheduleRepeat(time => { if (c >= total) return; const fr = frameAt(c, [1], 'pattern', 1); rig.triggerStep(fr.step, time, pr.patterns[1], c, step); c++; }, '16n', 0, total * step);
        transport.start(0.05);
      }, seconds, 2, 44100);
      return +(((performance.now() - t) / 1000) / seconds).toFixed(2);
    };
    const r = {};
    r.master = JSON.stringify((SAMPLE_PROJECTS['Hip Hop Demo']()).master);
    r.baseline = await run('base');
    r.noMasterReverb = await run('nmr', (rig) => { rig.masterIn.disconnect(); rig.eq.disconnect(); rig.comp.disconnect(); rig.masterIn.chain(rig.eq, rig.comp, rig.masterVol, rig.limiter); });
    r.noSendReverbDelay = await run('nsr', (rig) => { rig.sendReverb.disconnect(); rig.delay.disconnect(); });
    r.noEffectsAtAll = await run('nofx', (rig) => { rig.masterIn.disconnect(); rig.eq.disconnect(); rig.comp.disconnect(); rig.masterIn.chain(rig.masterVol, rig.limiter); rig.sendReverb.disconnect(); rig.delay.disconnect(); });
    r.noAmbient = await run('noamb', null, pr => { pr.patterns.forEach(pt => { delete pt.notes.ambient; }); });
    r.noArp = await run('noarp', null, pr => { pr.patterns.forEach(pt => { delete pt.notes.arp; }); });
    r.noMelody = await run('nomel', null, pr => { pr.patterns.forEach(pt => { delete pt.notes.melody; }); });
    r.noSynth = await run('nosyn', null, pr => { pr.patterns.forEach(pt => { delete pt.notes.synth; }); });
    r.drumsOnly = await run('drums', null, pr => { pr.patterns.forEach(pt => { pt.notes = {}; }); });
    r.silentEverything = await run('silent', null, pr => { pr.patterns.forEach(pt => { pt.notes = {}; ['kick','snare','hat','clap'].forEach(k => { pt.drums[k] = pt.drums[k].map(() => false); }); }); });
    return r;
  });
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
