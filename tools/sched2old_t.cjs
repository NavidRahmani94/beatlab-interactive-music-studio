const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 5 });
  p.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
  await p.goto('http://localhost:5200/'); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    const { Rig } = await import('/rig.ts');
    window.__calls = []; window.__rigs = new Set(); window.__maxVoices = {};
    const orig = Rig.prototype.triggerStep;
    Rig.prototype.triggerStep = function (step, time, pattern, tick, ss) { window.__rigs.add(this); window.__calls.push([tick, time, performance.now()]); return orig.call(this, step, time, pattern, tick, ss); };
    setInterval(() => { for (const rig of window.__rigs) rig.tracks.forEach(({ voice }, id) => { const s = voice.synth; const n = typeof s.activeVoices === 'number' ? s.activeVoices : (s._voices ? s._voices.length : (s.voices ? s.voices.length : -1)); window.__maxVoices[id] = Math.max(window.__maxVoices[id] ?? 0, n); }); }, 200);
  });
  for (const mode of ['SONG']) {
    await p.click(`[aria-label="Play mode"] >> text="${mode}"`); await p.waitForTimeout(300);
    await p.evaluate(() => { window.__calls = []; });
    await p.click('button.play >> nth=0'); await p.waitForTimeout(40000);
    const clean = await p.evaluate(() => { const c = window.__calls.map(x => x[2]); const l = c.slice(1).map((t, i) => t - c[i]); l.sort((a, b) => a - b); return { n: l.length, median: Math.round(l[l.length >> 1]), p95: Math.round(l[Math.floor(l.length * .95)]), p99: Math.round(l[Math.floor(l.length * .99)]), max: Math.round(l[l.length - 1]), over250: l.filter(v => v > 250).length }; });
    console.log(mode, 'continuous playback 40s', JSON.stringify(clean));
    for (let i = 0; i < 0; i++) { await p.click('button.stop >> nth=0'); await p.waitForTimeout(200); await p.click('button.play >> nth=0'); await p.waitForTimeout(500); }
    await p.waitForTimeout(5000);
    const r = await p.evaluate(() => { const c = window.__calls; const ticks = c.map(x => x[0]); const seen = new Map(); let dup = 0, gaps = 0; ticks.forEach((t, i) => { if (i && t !== ticks[i - 1] + 1 && t !== 0) gaps++; }); 
      const times = c.map(x => x[1]); const byTime = new Map(); times.forEach(t => byTime.set(t.toFixed(4), (byTime.get(t.toFixed(4)) || 0) + 1)); byTime.forEach(v => { if (v > 1) dup += v - 1; });
      const lat = c.map(x => x[2]).slice(1).map((t, i) => t - c[i][2]); lat.sort((a, b) => a - b);
      return { calls: c.length, rigs: window.__rigs.size, dupSameTime: dup, tickGaps: gaps, maxVoices: window.__maxVoices, stepIntervalMs: { median: Math.round(lat[lat.length >> 1]), p99: Math.round(lat[Math.floor(lat.length * 0.99)]), max: Math.round(lat[lat.length - 1]) } }; });
    console.log(mode, JSON.stringify(r));
    await p.click('button.stop >> nth=0'); await p.waitForTimeout(500);
  }
  await b.close();
})();
