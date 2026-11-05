const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage();
  p.on('console', m => console.log('C', m.text().slice(0, 300))); p.on('pageerror', e => console.log('PE', String(e).slice(0, 300)));
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const urls = performance.getEntriesByType('resource').map(r => r.name);
    const ws = await import(urls.filter(n => /\/workletSynth\.ts/.test(n)).pop()); const Tone = await import(urls.filter(n => /deps\/tone\.js/.test(n)).pop());
    const ok = await ws.loadWorklet(); let err = null; try { const syn = await import(urls.filter(n => /\/synth\.ts/.test(n)).pop()); const s = new ws.WorkletSynth(syn.FACTORY_SOUNDS.supersaw.patch); s.connect(Tone.getDestination()); } catch (e) { err = String(e) + ' ' + (e.stack || '').slice(0, 300); }
    return { ok, err, engine2: ws.ENGINE2_ON, ctx: Tone.getContext().constructor.name };
  }); console.log(JSON.stringify(r)); await b.close(); })();
