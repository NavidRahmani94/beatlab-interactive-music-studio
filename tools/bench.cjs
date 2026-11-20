const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
  p.on('pageerror', e => console.log('ERR', e)); 
  await p.goto('http://localhost:5199/'); await p.waitForTimeout(2000);
  const out = await p.evaluate(async () => {
    const { renderProjectToWav, exportDurationSeconds } = await import('/exporter.ts');
    const { SAMPLE_PROJECTS } = await import('/project.ts');
    const res = {};
    const run = async (label, mut) => {
      const pr = SAMPLE_PROJECTS['Hip Hop Demo'](); mut && mut(pr);
      const t = performance.now(); const r = await renderProjectToWav(pr, 4, { mode: 'pattern', pattern: 1, format: 'wav16' });
      res[label] = { wall: +((performance.now() - t) / 1000).toFixed(2), audio: +r.seconds.toFixed(1) };
    };
    const only = inst => pr => { pr.patterns.forEach(pt => { pt.notes = {}; ['kick','snare','hat','clap'].forEach(k => { if (k !== inst) pt.drums[k] = pt.drums[k].map(() => false); }); }); };
    console.log(Object.keys(SAMPLE_PROJECTS['Hip Hop Demo']().patterns[1]));
    await run('silent', pr => { pr.patterns.forEach(pt => { pt.notes = {}; ['kick','snare','hat','clap'].forEach(k => { pt.drums[k] = pt.drums[k].map(() => false); }); }); });
    for (const i of ['kick','snare','hat','clap']) await run(i, only(i));
    return res;
  });
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
