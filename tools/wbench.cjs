// Prototype benchmark: the same chords through the OLD engine (Tone graph, Rig) and the NEW engine (AudioWorklet), offline. Cost = render time / audio time.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage();
  p.on('console', m => { const t = m.text(); if (/^R /.test(t)) console.log(t); });
  p.on('pageerror', e => console.log('PAGEERROR', String(e)));
  await p.goto(process.argv[2]); if (process.argv[3]) { await p.evaluate(h => location.hash = h, process.argv[3]); }; await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    const urls = performance.getEntriesByType('resource').map(r => r.name);
    const { Rig } = await import(urls.filter(n => /\/rig\.ts/.test(n)).pop()); const Tone = await import(urls.filter(n => /deps\/tone\.js/.test(n)).pop());
    const syn = await import(urls.filter(n => /\/synth\.ts/.test(n)).pop());
    const src = await (await fetch('/voiceWorklet.js')).text(); const modUrl = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    const midi = m => 440 * Math.pow(2, (m - 69) / 12);
    const chordMidi = { 4: [57, 60, 64, 67], 6: [57, 60, 64, 67, 71, 74] };
    const patches = { warmPad: { osc1: { wave: 'sawtooth', octave: 0, cents: 0, level: 0.7, fmIndex: 0, fmRatio: 1 }, osc2: { wave: 'sawtooth', octave: 0, cents: 0, level: 0, fmIndex: 0, fmRatio: 1 }, unison: 3, spread: 30, pulseWidth: 0.5, pwmRate: 2, noise: 0, noiseColor: 'white', filter: { type: 'lowpass', cutoff: 1400, resonance: 1, rolloff: 12, envAmount: 0 }, filterEnv: { a: 0.01, d: 0.3, s: 1, r: 0.3 }, ampEnv: { a: 0.35, d: 0.4, s: 0.7, r: 1.2 }, lfo: { target: 'off' }, drive: 0, chorus: 0, volumeDb: -6, transpose: 0 } };
    for (const id of ['supersaw', 'cinematic', 'choirPad', 'pluck2']) { const f = syn.FACTORY_SOUNDS[id]; if (f) patches[id] = f.patch; }
    const secs = 6; const process_all = location.hash === '#all';
    const runOld = async (id, notes, every, dur) => { const t0 = performance.now(); let peak = 0, sq = 0;
      const buf = await Tone.Offline(async ({ transport }) => { const rig = new Rig(); rig.setShapeVoices([{ instrument: id, volumeDb: 0 }]); await rig.ready(); let n = 0; transport.bpm.value = 120; const sv = rig.shapeVoices.get(0);
        transport.scheduleRepeat(time => { if (n++ % every) return; notes.forEach(m => sv.voice.synth.triggerAttackRelease(rig.pitchOf(Tone.Frequency(m, 'midi').toNote(), sv.voice.shift), dur, time, 0.6)); }, '16n', 0, secs); transport.start(0.1); }, secs, 2, 44100);
      const ch = buf.get().getChannelData(0); for (let i = 0; i < ch.length; i++) { peak = Math.max(peak, Math.abs(ch[i])); sq += ch[i] * ch[i]; } return { cost: (performance.now() - t0) / (secs * 1000), peak, rms: Math.sqrt(sq / ch.length) }; };
    const runNew = async (patch, notes, every, dur) => { const t0 = performance.now();
      const ctx = new OfflineAudioContext(2, secs * 44100, 44100); await ctx.audioWorklet.addModule(modUrl);
      const list = []; for (let k = 0, t = 0.1; t < secs - 0.2; k++, t += 0.125) if (k % every === 0) notes.forEach(m => list.push({ start: t, dur, freq: midi(m), vel: 0.6 }));
      const node = new AudioWorkletNode(ctx, 'beatlab-synth', { outputChannelCount: [2], processorOptions: { patch, notes: list } }); node.connect(ctx.destination);
      const buf = await ctx.startRendering(); const ch = buf.getChannelData(0); let peak = 0, sq = 0; for (let i = 0; i < ch.length; i++) { peak = Math.max(peak, Math.abs(ch[i])); sq += ch[i] * ch[i]; }
      return { cost: (performance.now() - t0) / (secs * 1000), peak, rms: Math.sqrt(sq / ch.length) }; };
    const lp = await import(urls.filter(n => /\/legacyPatches\.ts/.test(n)).pop()); if (location.hash === '#legacy') { for (const id of Object.keys(lp.LEGACY_PATCHES)) { const pa = lp.LEGACY_PATCHES[id]; for (const [n, every, dur, tag] of [[4, 2, 0.24, '4/8'], [6, 1, 0.12, '6/16']]) { const o = await runOld(id, chordMidi[n], every, dur); const w = await runNew(pa, chordMidi[n], every, dur); console.log('R L ' + id.padEnd(14) + tag + ' rmsOld/New ' + (o.rms / w.rms).toFixed(2) + ' cost ' + o.cost.toFixed(2) + ' -> ' + w.cost.toFixed(2) + ' (' + (o.cost / w.cost).toFixed(0) + 'x)'); } } return; }
    const ids = Object.keys(syn.FACTORY_SOUNDS); if (process_all) { for (const id of ids) { patches[id] = syn.FACTORY_SOUNDS[id].patch; const o = await runOld(id, [57,60,64], 2, 0.4); const w = await runNew(patches[id], [57,60,64], 2, 0.4); console.log('R L ' + id.padEnd(16) + ' ratio ' + (o.rms / w.rms).toFixed(2) + ' peakNew ' + w.peak.toFixed(2) + ' cost ' + o.cost.toFixed(2) + '/' + w.cost.toFixed(2)); } return; }
    const rows = [['warmPad', 'warmPad', 4, 2, 0.24], ['warmPad', 'warmPad', 6, 1, 0.12], ['supersaw', 'supersaw', 4, 2, 0.24], ['supersaw', 'supersaw', 6, 1, 0.12], ['cinematic', 'cinematic', 4, 2, 0.24], ['choirPad', 'choirPad', 4, 2, 0.24]];
    for (const [pid, oid, n, every, dur] of rows) { if (!patches[pid]) continue;
      const o = await runOld(oid, chordMidi[n], every, dur); const w = await runNew(patches[pid], chordMidi[n], every, dur);
      console.log('R ' + (pid + ' ' + n + '-note chord /' + (every === 2 ? '1/8' : '1/16')).padEnd(34) + ' OLD ' + o.cost.toFixed(2) + ' (peak ' + o.peak.toFixed(2) + ')   NEW ' + w.cost.toFixed(2) + ' (peak ' + w.peak.toFixed(2) + ')   => ' + (o.cost / w.cost).toFixed(1) + 'x  RMS old/new ' + (o.rms / w.rms).toFixed(2)); }
  });
  await b.close();
})();
