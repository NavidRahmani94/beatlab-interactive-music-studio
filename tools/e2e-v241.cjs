// v0.24.1: the shapes start and stay in time with the track (their notes are placed on the exact audio time of each song step)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await (await b.newContext({ viewport: { width: 1280, height: 1100 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  let bad = 0; const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  await p.goto(process.argv[2]); await p.waitForTimeout(1200);
  await p.evaluate(async () => {
    const rn = performance.getEntriesByType('resource').map(r => r.name).filter(n => /\/rig\.ts/.test(n)).pop(); const { Rig } = await import(rn || '/src/audio/rig.ts');
    window.__steps = []; window.__shots = [];
    const ts = Rig.prototype.triggerStep; Rig.prototype.triggerStep = function (step, time, ...r) { window.__steps.push({ tick: r[1], time }); return ts.call(this, step, time, ...r); };
    const ss = Rig.prototype.shapeShot; Rig.prototype.shapeShot = function (i, n, s, v, time) { window.__shots.push({ time, now: this.safety.context.currentTime }); return ss.call(this, i, n, s, v, time); };
  });
  const panel = p.locator('section.shape');
  await panel.locator('.hand-switch').first().click(); await p.waitForTimeout(700);
  await panel.getByRole('switch', { name: /PLAY THE SHAPES/ }).click(); await p.waitForTimeout(800);
  await p.evaluate(() => { window.__steps = []; window.__shots = []; });
  await p.mouse.click(5, 5); await p.keyboard.press('Space'); await p.waitForTimeout(2600);
  const r = await p.evaluate(() => ({ steps: window.__steps, shots: window.__shots }));
  const stepTimes = new Set(r.steps.map(s => s.time));
  const withTime = r.shots.filter(s => s.time !== undefined);
  ok('the shapes made notes while the song played', withTime.length >= 4, 'notes ' + withTime.length);
  ok('every shape note sits exactly on a song step time', withTime.length > 0 && withTime.every(s => stepTimes.has(s.time)), JSON.stringify(withTime.slice(0, 3)));
  ok('the first shape note starts together with the first step of the track', withTime.length > 0 && r.steps.length > 0 && withTime[0].time === r.steps[0].time, `shape ${withTime[0]?.time} step ${r.steps[0]?.time}`);
  ok('notes are planned on the audio clock (at most a few ms behind it, like the tracks)', withTime.every(s => s.time >= s.now - 0.05), JSON.stringify(withTime.find(s => s.time < s.now)));
  await p.keyboard.press('Space'); await p.waitForTimeout(600);
  await p.evaluate(() => { window.__shots = []; }); await p.waitForTimeout(1500);
  const after = await p.evaluate(() => window.__shots);
  ok('after stop the shapes keep their own beat (free clock)', after.length >= 2 && after.every(s => s.time === undefined), 'n=' + after.length);
  ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));
  console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
})();
