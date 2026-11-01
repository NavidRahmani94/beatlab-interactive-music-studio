const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
  p.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(2000);
  const out = await p.evaluate(async () => {
    const { renderProjectToWav } = await import('/exporter.ts'); const { SAMPLE_PROJECTS } = await import('/project.ts');
    const dec = async blob => { const ab = await blob.arrayBuffer(); const v = new DataView(ab); const n = (ab.byteLength - 44) / 4; const a = new Float32Array(n * 2); for (let i = 0; i < n * 2; i++) a[i] = v.getInt16(44 + i * 2, true) / 32768; return a; };
    const res = {};
    for (const name of ['Persian Mood', 'Hip Hop Demo', 'Synthwave 108']) {
      const pr = SAMPLE_PROJECTS[name](); const slots = pr.playlist.filter(x => x !== null).length;
      const r = await renderProjectToWav(pr, 1, { mode: 'song', pattern: 0, format: 'wav16' });
      const a = await dec(r.blob); const sr = 44100; const win = sr * 2 * 5; const rows = [];
      for (let i = 0; i + win <= a.length; i += win) { let pk = 0, clip = 0, ss = 0; for (let j = i; j < i + win; j++) { const x = Math.abs(a[j]); if (x > pk) pk = x; if (x >= 0.985) clip++; ss += x * x; } rows.push({ t: i / sr / 2, peak: +pk.toFixed(3), clipped: clip, rmsDb: +(20 * Math.log10(Math.sqrt(ss / win) + 1e-9)).toFixed(1) }); }
      res[name] = { bpm: pr.bpm, seconds: +r.seconds.toFixed(1), master: pr.master, windows: rows };
      if (name === 'Persian Mood') break;
    }
    return res;
  });
  for (const [k, v] of Object.entries(out)) { console.log(k, 'bpm', v.bpm, 'sec', v.seconds, JSON.stringify(v.master)); v.windows.forEach(w => console.log('  t=' + String(w.t).padStart(3), 'peak', w.peak, 'clippedSamples', w.clipped, 'rms', w.rmsDb + ' dBFS')); }
  await b.close();
})();
