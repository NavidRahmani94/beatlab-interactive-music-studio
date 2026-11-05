// AIR CONTROL end-to-end with a FAKE camera and a FAKE hand tracker (there is no real hand to find). It checks the panel, camera on/off, and that gestures drive the real app.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ permissions: ['camera'], viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage(); let bad = 0; const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  await p.addInitScript(() => { window.__BEATLAB_HAND_MOCK__ = async () => ({ detect: () => (window.__hands ?? []), close() { window.__trackerClosed = true; } }); });
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  const panel = p.locator('section.hand');
  ok('panel exists, camera off by default', (await panel.count()) === 1 && (await panel.locator('video').count()) === 0);
  ok('instructions are visible before the camera is on', (await panel.locator('.hand-list li').count()) === 1, await panel.locator('.hand-list li').count());
  // synthetic hands (raw camera coordinates; the app mirrors them)
  await p.evaluate(() => {
    const H = (pose, cx, cy, size = 0.2) => { const P = (x, y) => ({ x: cx + x * size, y: cy + y * size }); const lm = []; lm[0] = P(0, 0);
      [[-0.35, -0.95], [0, -1], [0.3, -0.95], [0.6, -0.85]].forEach(([x, y], i) => { const bb = 5 + i * 4, e = pose.f[i]; lm[bb] = P(x, y); lm[bb + 1] = P(x, y - (e ? 0.4 : 0.3)); lm[bb + 2] = P(x, y - (e ? 0.65 : 0.05)); lm[bb + 3] = P(x, y - (e ? 0.9 : -0.2)); });
      lm[1] = P(-0.3, -0.2); lm[2] = P(-0.55, -0.45);
      if (pose.t === 'folded') { lm[3] = P(-0.2, -0.55); lm[4] = P(-0.05, -0.6); } else if (pose.t === 'out') { lm[3] = P(-0.8, -0.6); lm[4] = P(-1.1, -0.75); } else if (pose.t === 'up') { lm[3] = P(-0.7, -1.1); lm[4] = P(-0.9, -1.5); }
      return lm; };
    window.__H = H; window.__open = (x = 0.5, y = 0.6) => [H({ t: 'out', f: [1, 1, 1, 1] }, x, y)]; window.__fist = () => [H({ t: 'folded', f: [0, 0, 0, 0] }, 0.5, 0.6)];
    window.__up = () => [H({ t: 'up', f: [0, 0, 0, 0] }, 0.5, 0.6)]; window.__point = (y) => [H({ t: 'folded', f: [1, 0, 0, 0] }, 0.5, y)]; window.__vic = () => [H({ t: 'folded', f: [1, 1, 0, 0] }, 0.5, 0.6)];
  });
  await panel.getByRole('switch').click(); await p.waitForTimeout(1500);
  ok('camera on: preview + status show', (await panel.locator('video').count()) === 1 && (await panel.locator('.hand-status').count()) === 1);
  ok('instructions stay next to the camera', await panel.locator('.hand-cam').count() === 1 && await panel.locator('.hand-help').count() === 1);
  const playing = async () => (await p.locator('button.stop').count()) > 0;
  const bpmNow = async () => p.evaluate(() => document.getElementById('bpm')?.value);
  await p.evaluate(() => { window.__hands = window.__open(); }); await p.waitForTimeout(1500);
  ok('open palm held = PLAY', await playing());
  await p.evaluate(() => { window.__hands = window.__up(); }); await p.waitForTimeout(1500);
  ok('thumb up does nothing now (tempo is switched off)', await playing());
  await p.evaluate(() => { window.__hands = window.__fist(); }); await p.waitForTimeout(1500);
  ok('fist held = STOP', !(await playing()));
  // untick a function: it must stop working
  await panel.getByLabel('PLAY and STOP on').uncheck(); await p.evaluate(() => { window.__hands = window.__open(0.3, 0.6); }); await p.waitForTimeout(300); await p.evaluate(() => { window.__hands = window.__open(0.5, 0.6); }); await p.waitForTimeout(1500);
  ok('an unticked function does nothing', !(await playing()));
  const tipTxt = await panel.locator('.hand-gesture b').innerText(); ok('status shows the gesture name', /PALM|FIST|THUMB|INDEX|VICTORY|NO HAND/.test(tipTxt), tipTxt);
  await panel.getByRole('switch').click(); await p.waitForTimeout(500);
  ok('camera off again: preview gone, tracker closed', (await panel.locator('video').count()) === 0 && (await p.evaluate(() => window.__trackerClosed === true)));
  console.log(errs.length ? errs.join('\n') : 'no page errors'); ok('no page errors', errs.length === 0);
  console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close();
})();
