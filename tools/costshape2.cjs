// Dev tool: cost of a few realistic SHAPE LAB setups (offline render time / audio time). Usage: node costshape2.cjs <url>
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage();
  p.on('console', m => { const t = m.text(); if (/^R /.test(t)) console.log(t); });
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    const urls = performance.getEntriesByType('resource').map(r => r.name);
    const { Rig } = await import(urls.filter(n => /\/rig\.ts/.test(n)).pop()); const Tone = await import(urls.filter(n => /deps\/tone\.js/.test(n)).pop());
    // scenario: list of shapes {instrument, notes per hit, every N sixteenths}
    const run = async (name, shapes, secs = 6) => {
      const t0 = performance.now(); let peak = 0;
      const buf = await Tone.Offline(async ({ transport }) => {
        const rig = new Rig(); rig.setShapeVoices(shapes.map(s => ({ instrument: s.i, volumeDb: -8 }))); await rig.ready();
        let n = 0; transport.bpm.value = 120;
        transport.scheduleRepeat(time => { shapes.forEach((s, li) => { if (n % s.every) return; const sv = rig.shapeVoices.get(li); s.notes.forEach(nt => sv.voice.synth.triggerAttackRelease(rig.pitchOf(nt, sv.voice.shift), s.dur, time, 0.6)); }); n++; }, '16n', 0, secs); transport.start(0.1);
      }, secs, 2, 44100);
      const ch = buf.get().getChannelData(0); for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
      console.log('R ' + name.padEnd(58) + ' ' + ((performance.now() - t0) / (secs * 1000)).toFixed(2) + '  peak ' + peak.toFixed(2));
    };
    const ch3 = ['A3', 'C4', 'E4'], ch4 = ['A3', 'C4', 'E4', 'G4'], ch5 = ['A3', 'C4', 'E4', 'G4', 'B4'];
    await run('idle (no notes)', [{ i: 'pluck', notes: [], every: 8, dur: .1 }]);
    await run('1 shape, pluck, 3-note arp one note / 1/8', [{ i: 'pluck', notes: ['A3'], every: 2, dur: .17 }]);
    await run('1 shape, electricPiano, one note / 1/8', [{ i: 'electricPiano', notes: ['A3'], every: 2, dur: .17 }]);
    await run('1 shape, warmPad, one note / 1/8', [{ i: 'warmPad', notes: ['A3'], every: 2, dur: .17 }]);
    await run('1 shape, warmPad, 4-note CHORD every 1/8', [{ i: 'warmPad', notes: ch4, every: 2, dur: .24 }]);
    await run('1 shape, strings, 4-note CHORD every 1/4', [{ i: 'strings', notes: ch4, every: 4, dur: .47 }]);
    await run('3 shapes: ePiano arp 1/8 + warmPad chord 1/4 + pluck arp 1/16', [{ i: 'electricPiano', notes: ['A3'], every: 2, dur: .17 }, { i: 'warmPad', notes: ch4, every: 4, dur: .47 }, { i: 'pluck', notes: ['C5'], every: 1, dur: .08 }]);
    await run('3 shapes, all CHORD 1/8 (3,4,5 notes) piano/pad/pluck', [{ i: 'electricPiano', notes: ch3, every: 2, dur: .24 }, { i: 'warmPad', notes: ch4, every: 2, dur: .24 }, { i: 'pluck', notes: ch5, every: 2, dur: .24 }]);
  });
  await b.close();
})();
