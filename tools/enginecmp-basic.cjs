// Engine comparison for the 11 basic instruments (rig.ts buildMelody on the old engine vs legacyPatches.ts on engine 2). See enginecmp.cjs.
// Renders every factory sound on the OLD engine (PatchSynth / Tone) and engine 2 (worklet), same note, and compares.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', String(e)));
  await p.goto(process.argv[2]); await p.waitForTimeout(2000);
  const only = process.argv[3] || '';
  const res = await p.evaluate(async (only) => {
    const urls = performance.getEntriesByType('resource').map(r => r.name);
    const Tone = await import(urls.filter(n => /deps\/tone\.js/.test(n)).pop());
    const { PatchSynth } = await import('/patchSynth.ts'); const syn = await import('/synth.ts');
    const src = await (await fetch('/voiceWorklet.js?t=' + Date.now())).text(); const modUrl = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    const SR = 44100, SECS = 3, NOTE = 57, DUR = 0.9, VEL = 0.8, T0 = 2176 / 44100;
    const hz = 440 * Math.pow(2, (NOTE - 69) / 12);
    const rigm = await import('/rig.ts'); const lp = await import('/legacyPatches.ts');
    const old = async id => (await Tone.Offline(async () => { const m = rigm.buildMelody(id); m.synth.volume.value = m.volume; if (m.filter) { m.synth.connect(m.filter); m.filter.toDestination(); } else m.synth.toDestination(); m.synth.triggerAttackRelease(Tone.Frequency(NOTE + m.shift, 'midi').toNote(), DUR, T0, VEL); }, SECS, 2, SR)).get();
    const neu = async patch => { const ctx = new OfflineAudioContext(2, SECS * SR, SR); await ctx.audioWorklet.addModule(modUrl);
      const node = new AudioWorkletNode(ctx, 'beatlab-synth', { numberOfInputs: 0, outputChannelCount: [2], processorOptions: { patch, notes: [{ id: 1, start: T0, dur: DUR, freq: hz, vel: VEL }] } }); node.connect(ctx.destination); return ctx.startRendering(); };
    const mono = buf => { const a = buf.getChannelData(0), c = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a; const m = new Float32Array(a.length); for (let i = 0; i < a.length; i++) m[i] = (a[i] + c[i]) / 2; return m; };
    const envDb = x => { const F = 441, out = []; for (let i = 0; i + F <= x.length; i += F) { let s = 0; for (let j = 0; j < F; j++) s += x[i + j] * x[i + j]; out.push(10 * Math.log10(s / F + 1e-20)); } return out; };
    const fft = (re, im) => { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
      for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k); const xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c; re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; } } };
    const N = 4096, BANDS = []; for (let f = 50; f < 16000; f *= Math.pow(2, 1 / 3)) BANDS.push(f);
    const spec = x => { const pw = new Float64Array(N / 2); const end = Math.min(x.length, Math.round((T0 + DUR) * SR)); let frames = 0;
      for (let st = Math.round(T0 * SR); st + N <= end + N / 2 && st + N <= x.length; st += N / 2) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = x[st + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); fft(re, im); for (let k = 0; k < N / 2; k++) pw[k] += re[k] * re[k] + im[k] * im[k]; frames++; }
      const bands = BANDS.map(f => { const lo = Math.floor(f * Math.pow(2, -1 / 6) / SR * N), hi = Math.ceil(f * Math.pow(2, 1 / 6) / SR * N); let s = 0; for (let k = lo; k <= hi && k < N / 2; k++) s += pw[k]; return s; });
      const tot = bands.reduce((a, b) => a + b, 0) || 1e-20; let cen = 0, ps = 0; for (let k = 1; k < N / 2; k++) { cen += pw[k] * k * SR / N; ps += pw[k]; }
      return { db: bands.map(v => 10 * Math.log10(v / tot + 1e-20)), centroid: cen / (ps || 1e-20) }; };
    const out = [];
    const ids = Object.keys(lp.LEGACY_PATCHES).filter(id => !only || only.split(',').includes(id));
    for (const id of ids) {
      const patch = lp.LEGACY_PATCHES[id];
      const a = mono(await old(id)), w = mono(await neu(patch));
      const ea = envDb(a), ew = envDb(w); const ma = Math.max(...ea), mw = Math.max(...ew);
      let ed = 0, en = 0; for (let i = 0; i < ea.length; i++) { const x = Math.max(ea[i] - ma, -60), y = Math.max(ew[i] - mw, -60); if (x > -59 || y > -59) { ed += Math.abs(x - y); en++; } }
      const sa = spec(a), sw = spec(w); let sd = 0, sn = 0; const smax = Math.max(...sa.db);
      for (let i = 0; i < sa.db.length; i++) if (sa.db[i] > smax - 50 || sw.db[i] > smax - 50) { sd += Math.abs(Math.max(sa.db[i], smax - 60) - Math.max(sw.db[i], smax - 60)); sn++; }
      // time for the level to fall 20 dB below its peak (shows decay speed)
      const fall = (e, m) => { const pk = e.indexOf(m); for (let i = pk; i < e.length; i++) if (e[i] < m - 20) return (i - pk) * 0.01; return 9; };
      const rms = x => { let q = 0; for (let i = 0; i < x.length; i++) q += x[i] * x[i]; return Math.sqrt(q / x.length); };
      out.push({ rmsDb: 20 * Math.log10(rms(w) / rms(a)), id, env: ed / Math.max(1, en), spec: sd / Math.max(1, sn), cen: sw.centroid / sa.centroid, fallOld: fall(ea, ma), fallNew: fall(ew, mw), lvl: mw - ma });
    }
    return out;
  }, only);
  res.sort((x, y) => (y.env + y.spec) - (x.env + x.spec));
  let se = 0, ss = 0;
  for (const r of res) { se += r.env; ss += r.spec; if (process.argv[4] !== 'quiet') console.log(r.id.padEnd(16), 'env', r.env.toFixed(1).padStart(5), 'dB  spec', r.spec.toFixed(1).padStart(5), 'dB  bright', r.cen.toFixed(2), ' -20dB at', r.fallOld.toFixed(2) + 's /', r.fallNew.toFixed(2) + 's', ' level', r.lvl.toFixed(1)); }
  if (process.env.TRIMS) console.log('TRIMS ' + JSON.stringify(Object.fromEntries(res.map(r => [r.id, Math.round(-r.rmsDb * 10) / 10]))));
  console.log('MEAN env diff', (se / res.length).toFixed(2), 'dB | spectrum diff', (ss / res.length).toFixed(2), 'dB | sounds', res.length);
  await b.close();
})();
