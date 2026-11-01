const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto(process.argv[2]); await p.waitForTimeout(1000);
  const out = await p.evaluate(async () => {
    const { MELODY_INSTRUMENT_IDS } = await import('/instruments.ts'); const mod = await import('/instruments.ts'); const T = await import(performance.getEntriesByType('resource').map(r => r.name).find(n => /tone/.test(n)) || 'tone');
    const res = {};
    for (const id of MELODY_INSTRUMENT_IDS) { const m = mod.buildMelody(id); const s = m.synth; const v = s._voices && s._voices[0] || s.voice; res[id] = [s.constructor.name, v ? v.constructor.name : '-', v && v.detune ? 'detune' : 'NO-detune', typeof s._triggerAttack === 'function' ? 'hook' : 'NOHOOK', m.shift]; s.dispose(); }
    return res;
  });
  const g = {}; for (const [k, v] of Object.entries(out)) { const key = v.join(' '); (g[key] = g[key] || []).push(k); }
  for (const [k, v] of Object.entries(g)) console.log(k, '=>', v.join(','));
  await b.close();
})();
