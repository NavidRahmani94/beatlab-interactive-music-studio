const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
  p.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(2000);
  const out = await p.evaluate(async () => {
    const { Rig } = await import('/rig.ts'); const { renderProjectToWav } = await import('/exporter.ts'); const { SAMPLE_PROJECTS } = await import('/project.ts');
    const ready = Rig.prototype.ready; Rig.prototype.ready = async function () { await ready.call(this); if (window.__mut) window.__mut(this); };
    const dec = async blob => { const ab = await blob.arrayBuffer(); const v = new DataView(ab); const n = (ab.byteLength - 44) / 2; const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = v.getInt16(44 + i * 2, true) / 32768; return a; };
    const run = async (name, db, noSafety) => {
      const pr = SAMPLE_PROJECTS[name](); pr.master = { ...pr.master, volumeDb: db };
      window.__mut = noSafety ? rig => { rig.safety.setMap(x => x); rig.safety.oversample = 'none'; } : null;
      const t = performance.now();
      const r = await renderProjectToWav(pr, 1, { mode: 'pattern', pattern: pr.playlist.find(x => x !== null) ?? 0, format: 'wav16' });
      const a = await dec(r.blob); let pk = 0, hi = 0; for (const x of a) { const y = Math.abs(x); if (y > pk) pk = y; if (y >= 0.99) hi++; }
      return { peak: +pk.toFixed(3), samplesAt99: hi, secs: +((performance.now() - t) / 1000).toFixed(1), audio: +r.seconds.toFixed(1), data: a };
    };
    const res = {};
    for (const [name, db] of [['Hip Hop Demo', 0], ['Hip Hop Demo', 9]]) {
      const old = await run(name, db, true); const nw = await run(name, db, false);
      const n = Math.min(old.data.length, nw.data.length); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += old.data[i] * nw.data[i]; saa += old.data[i] ** 2; sbb += nw.data[i] ** 2; }
      res[name + ' @' + db + 'dB'] = { without: { peak: old.peak, samplesAt99: old.samplesAt99 }, with: { peak: nw.peak, samplesAt99: nw.samplesAt99 }, corr: +(sab / Math.sqrt(saa * sbb)).toFixed(4), renderSecs: nw.secs, audioSecs: nw.audio };
    }
    return res;
  });
  console.log(JSON.stringify(out)); await b.close();
})();
