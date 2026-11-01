const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
  p.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(2000);
  const out = await p.evaluate(async () => {
    const Tone = await import('/node_modules/.vite/deps/tone.js');
    const { Rig } = await import('/rig.ts'); const { SAMPLE_PROJECTS } = await import('/project.ts'); const { frameAt } = await import('/song.ts');
    const run = async (name, boostDb, noSafety) => {
      const pr = SAMPLE_PROJECTS[name](); pr.master = { ...pr.master, volumeDb: boostDb };
      const step = 60 / pr.bpm / 4; const total = 32 * 6; const seconds = total * step + 2;
      const buf = await Tone.Offline(async ({ transport }) => {
        const rig = new Rig(); rig.setSynths(pr.synths); rig.setDrumKit(pr.drumKit); rig.setGroove(pr.groove); rig.setTracks(pr.tracks); rig.setMaster(pr.master); rig.setChannels(pr.channels); rig.setTempo(pr.bpm);
        await rig.ready();
        if (noSafety) { rig.safety.setMap(x => x); rig.safety.oversample = 'none'; }
        let c = 0; transport.bpm.value = pr.bpm;
        transport.scheduleRepeat(time => { if (c >= total) return; const fr = frameAt(c, pr.playlist.slice(0, 6), 'song', 0); rig.triggerStep(fr.step, time, pr.patterns[fr.pattern] ?? null, c, step); c++; }, '16n', 0, total * step);
        transport.start(0.05);
      }, seconds, 2, 44100);
      const a = buf.get().getChannelData(0); let pk = 0, over = 0, hi = 0; for (let i = 0; i < a.length; i++) { const x = Math.abs(a[i]); if (x > pk) pk = x; if (x > 1) over++; if (x >= 0.985) hi++; }
      return { peak: +pk.toFixed(3), samplesOver1: over, samplesAbove985: hi, data: Array.from(a.slice(0, 200000)) };
    };
    const res = {};
    for (const [name, db] of [['Persian Mood', 0], ['Persian Mood', 6], ['Hip Hop Demo', 6]]) {
      const old = await run(name, db, true); const nw = await run(name, db, false);
      // similarity on the quiet part
      let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < old.data.length; i++) { sab += old.data[i] * nw.data[i]; saa += old.data[i] ** 2; sbb += nw.data[i] ** 2; }
      res[name + ' @' + db + 'dB'] = { before: { peak: old.peak, over1: old.samplesOver1, above985: old.samplesAbove985 }, after: { peak: nw.peak, over1: nw.samplesOver1, above985: nw.samplesAbove985 }, corr: +(sab / Math.sqrt(saa * sbb)).toFixed(4) };
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
