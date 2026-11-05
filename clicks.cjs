// Dev tool: counts clicks (big jumps between samples) and voice steals in dense chord playback. Usage: node clicks.cjs <url>
// Does the sound have clicks? Counts big jumps between neighbouring samples (a click) and how often a busy voice was taken over (steal).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage();
  p.on('console', m => { const t = m.text(); if (/^R /.test(t)) console.log(t); });
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    const urls = performance.getEntriesByType('resource').map(r => r.name);
    const { Rig } = await import(urls.filter(n => /\/rig\.ts/.test(n)).pop()); const Tone = await import(urls.filter(n => /deps\/tone\.js/.test(n)).pop()); const { PatchSynth } = await import(urls.filter(n => /\/patchSynth\.ts/.test(n)).pop());
    const run = async (name, cap, shapes, secs = 6) => {
      PatchSynth.maxVoices = cap; PatchSynth.steals = 0; const t0 = performance.now();
      const buf = await Tone.Offline(async ({ transport }) => {
        const rig = new Rig(); rig.setShapeVoices(shapes.map(s => ({ instrument: s.i, volumeDb: -8 }))); await rig.ready();
        let n = 0; transport.bpm.value = 120;
        transport.scheduleRepeat(time => { shapes.forEach((s, li) => { if (n % s.every) return; const sv = rig.shapeVoices.get(li); s.notes.forEach(nt => sv.voice.synth.triggerAttackRelease(rig.pitchOf(nt, sv.voice.shift), s.dur, time, 0.6)); }); n++; }, '16n', 0, secs); transport.start(0.1);
      }, secs, 2, 44100);
      const ch = buf.get().getChannelData(0); let peak = 0, spikes = 0, worst = 0; for (let i = 1; i < ch.length; i++) { peak = Math.max(peak, Math.abs(ch[i])); const d = Math.abs(ch[i] - ch[i - 1]); if (d > 0.02) spikes++; worst = Math.max(worst, d); }
      console.log('R ' + name.padEnd(46) + ' cap ' + String(cap).padStart(3) + '  steals ' + String(PatchSynth.steals).padStart(3) + '  clicks ' + String(spikes).padStart(4) + '  worstJump ' + worst.toFixed(3) + '  cost ' + ((performance.now() - t0) / (secs * 1000)).toFixed(2) + '  peak ' + peak.toFixed(2));
    };
    const ch4 = ['A3', 'C4', 'E4', 'G4'];
    for (const cap of [16, 48]) await run('warmPad 4-note chord every 1/8', cap, [{ i: 'warmPad', notes: ch4, every: 2, dur: .24 }]);
    for (const cap of [16, 48]) await run('strings 4-note chord every 1/4', cap, [{ i: 'strings', notes: ch4, every: 4, dur: .47 }]);
    for (const cap of [16, 48]) await run('electricPiano 4-note chord every 1/8', cap, [{ i: 'electricPiano', notes: ch4, every: 2, dur: .24 }]);
    for (const cap of [16, 48]) await run('pluck arp 1/16 (one note)', cap, [{ i: 'pluck', notes: ['C5'], every: 1, dur: .08 }]);
  });
  await b.close();
})();
