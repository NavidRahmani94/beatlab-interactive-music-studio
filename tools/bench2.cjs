const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(2000);
  const out = await p.evaluate(async () => {
    const { renderProjectToWav } = await import('/exporter.ts');
    const { SAMPLE_PROJECTS } = await import('/project.ts');
    const { Rig } = await import('/rig.ts');
    const hatOnly = () => { const pr = SAMPLE_PROJECTS['Hip Hop Demo'](); pr.patterns.forEach(pt => { pt.notes = {}; ['kick','snare','clap'].forEach(k => { pt.drums[k] = pt.drums[k].map(() => false); }); }); return pr; };
    const dec = async blob => { const ab = await blob.arrayBuffer(); const v = new DataView(ab); const n = (ab.byteLength - 44) / 2; const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = v.getInt16(44 + i * 2, true) / 32768; return a; };
    const res = {};
    const nw = await dec((await renderProjectToWav(hatOnly(), 2, { mode: 'pattern', pattern: 1, format: 'wav16' })).blob);
    const orig = Rig.prototype.buildHat; Rig.prototype.buildHat = function () { this.hatBuf = null; };
    const old = await dec((await renderProjectToWav(hatOnly(), 2, { mode: 'pattern', pattern: 1, format: 'wav16' })).blob);
    Rig.prototype.buildHat = orig;
    const n = Math.min(nw.length, old.length); let sab = 0, saa = 0, sbb = 0, pa = 0, pb = 0;
    for (let i = 0; i < n; i++) { sab += nw[i] * old[i]; saa += nw[i] ** 2; sbb += old[i] ** 2; pa = Math.max(pa, Math.abs(nw[i])); pb = Math.max(pb, Math.abs(old[i])); }
    res.hat = { corr: +(sab / Math.sqrt(saa * sbb)).toFixed(4), peakNew: +pa.toFixed(3), peakOld: +pb.toFixed(3) };
    const t = performance.now(); const full = SAMPLE_PROJECTS['Hip Hop Demo'](); const r = await renderProjectToWav(full, 1, { mode: 'pattern', pattern: 1, format: 'wav16' });
    res.full = { wall: +((performance.now() - t) / 1000).toFixed(1), audio: +r.seconds.toFixed(1) };
    return res;
  });
  console.log(JSON.stringify(out)); await b.close();
})();
