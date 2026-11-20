const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto(process.argv[2]); await p.waitForTimeout(1000);
  await p.evaluate(() => { window.__only = ['squareLead','fmLead','whistle','violin','cello','flute','clarinet','oboe','sax','kamancheh','ney','zurna','sciFi','choirPad','sawLead','bass','electricPiano','pluck','lead','warmPad','strings','bell','supersaw','piano','organ']; });
  const out = await p.evaluate(async () => {
    const { MELODY_INSTRUMENT_IDS } = await import('/instruments.ts'); const { renderProjectToWav } = await import('/exporter.ts'); const { defaultProject } = await import('/project.ts'); const { defaultPatternData } = await import('/song.ts');
    const res = {};
    const cent = (d, t0) => { const s = Math.floor((t0 + 0.05) * 44100), L = 3000; const ac = []; for (let lag = 40; lag <= 400; lag++) { let sum = 0, e = 0; for (let i = 0; i < L; i++) { sum += d[s + i] * d[s + i + lag]; e += d[s + i] * d[s + i]; } ac.push(e > 1e-6 ? sum / e : 0); } const mx = Math.max(...ac); if (mx < 0.3) return 0; const i = ac.findIndex((v, k) => v > 0.9 * mx && (k === 0 || v >= ac[k - 1]) && (k === ac.length - 1 || v >= ac[k + 1])); return Math.round(44100 / (40 + i)); };
    const freq = cent;
    for (const inst of (window.__only || MELODY_INSTRUMENT_IDS)) {
      const row = [];
      for (const slide of [false, true]) {
        const notes = [{ id: 'a', pitch: 'C4', step: 0, lengthSteps: 12, velocity: 0.9, ...(slide ? { slide: true } : {}) }, { id: 'b', pitch: 'C5', step: 12, lengthSteps: 4, velocity: 0.9 }];
        const pr = defaultProject(); pr.bpm = 100; pr.patterns = [defaultPatternData('x', notes)]; pr.master = { ...pr.master, reverbMix: 0, compAmount: 0 };
        pr.tracks = pr.tracks.map(t => t.id === 'melody' ? { ...t, instrument: inst } : t); pr.channels = { ...pr.channels, melody: { ...pr.channels.melody, reverbSend: 0, delaySend: 0 } };
        const r = await renderProjectToWav(pr, 1, { mode: 'pattern', pattern: 0, format: 'wav16' });
        const ab = await r.blob.arrayBuffer(); const v = new DataView(ab); const n = (ab.byteLength - 44) / 4; const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = v.getInt16(44 + i * 4, true) / 32768;
        row.push([freq(d, 0.1), freq(d, 1.0)]);   // early, late in the 1.8 s long first note
      }
      res[inst] = row;
    }
    return res;
  });
  let bad = [];
  for (const [k, [plain, sl]] of Object.entries(out)) { const rose = sl[1] > sl[0] * 1.3; if (!rose) bad.push(k); console.log(k.padEnd(18), 'plain', JSON.stringify(plain), 'slide', JSON.stringify(sl), rose ? '' : '  <-- NO RISE'); }
  console.log('NO RISE:', bad.join(', ')); await b.close();
})();
