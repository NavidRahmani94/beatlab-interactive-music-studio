// Dev tool: renders dense chords offline for every instrument and reports the CPU cost (render time / audio time). Usage: node costshape.cjs <url>
// How heavy is each instrument? Renders 4 s of dense chords (6 notes, every 16th) offline and reports render time / audio time. Also the peak.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage();
  p.on('console', m => { const t = m.text(); if (/^(R |N=)/.test(t)) console.log(t); }); await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  const res = await p.evaluate(async () => {
    const urls = performance.getEntriesByType('resource').map(r => r.name);
    const rigUrl = urls.filter(n => /\/rig\.ts/.test(n)).pop(); const toneUrl = urls.filter(n => /deps\/tone\.js/.test(n)).pop(); const insUrl = urls.filter(n => /\/instruments\.ts/.test(n)).pop();
    const { Rig } = await import(rigUrl); const Tone = await import(toneUrl); const { MELODY_INSTRUMENT_IDS } = await import(insUrl);
    const out = []; console.log('N=' + MELODY_INSTRUMENT_IDS.length); const chord = ['A3', 'C4', 'E4', 'G4', 'B4', 'D5'];
    const run = async (ids, notes, secs = 4) => {
      const t0 = performance.now(); let peak = 0;
      const buf = await Tone.Offline(async ({ transport }) => {
        const rig = new Rig(); rig.setShapeVoices(ids.map(i => ({ instrument: i, volumeDb: -8 }))); await rig.ready();
        let n = 0; transport.scheduleRepeat(time => { ids.forEach((_, li) => { const sv = rig.shapeVoices.get(li); notes.forEach(nt => sv.voice.synth.triggerAttackRelease(rig.pitchOf(nt, sv.voice.shift), 0.12, time, 0.6)); }); n++; }, '16n', 0, secs); transport.bpm.value = 120; transport.start(0.1);
      }, secs, 2, 44100);
      const ch = buf.get().getChannelData(0); for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
      return { ms: performance.now() - t0, peak };
    };
    for (const id of MELODY_INSTRUMENT_IDS) { const r = await run([id], chord); out.push([id, +(r.ms / 4000).toFixed(2), +r.peak.toFixed(2)]); console.log('R ' + id + ' ' + (r.ms / 4000).toFixed(2) + ' ' + r.peak.toFixed(2)); }
    return out;
  });
  res.sort((a, c) => c[1] - a[1]); console.log('instrument  render/real-time  peak   (1 shape, 6-note chord every 16th, 120 bpm)');
  res.forEach(r => console.log(r[0].padEnd(22), String(r[1]).padStart(5), String(r[2]).padStart(5)));
  console.log('median', res[Math.floor(res.length / 2)][1]); await b.close();
})();
