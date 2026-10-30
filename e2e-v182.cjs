const { chromium } = require('playwright');
const URL = process.argv[2]; const results = [];
const ok = (n, c, d = '') => { results.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  [' + d + ']' : '')); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1000);
  await p.click('button[role="tab"]:text-is("SYNTH")');
  const sec = 'section[aria-label="Synth track"]';
  await p.click('text=CHORD BUILDER'); await p.click('button[aria-label^="Insert chord"] >> nth=0'); await p.waitForTimeout(300);
  const bars = async step => p.$$eval(`${sec} [data-vstep="${step}"] .vel-note`, e => e.map(x => ({ label: x.getAttribute('aria-label'), v: Number(x.getAttribute('aria-valuenow')) })));
  let b0 = await bars(0);
  ok('a triad shows 3 separate velocity bars on its step', b0.length === 3, JSON.stringify(b0));
  ok('block chord: root loudest, upper notes slightly softer', b0[0].v > b0[1].v && b0[1].v > b0[2].v, b0.map(x => x.v).join('/'));
  // drag only the middle bar to ~20
  const cell = await p.locator(`${sec} [data-vstep="0"]`); await cell.scrollIntoViewIfNeeded();
  const box = await cell.boundingBox();
  const x = box.x + box.width * 0.5; // middle of three
  await p.mouse.move(x, box.y + box.height * 0.2); await p.mouse.down(); await p.mouse.move(x, box.y + box.height * 0.8, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200);
  const b1 = await bars(0);
  ok('only the dragged note changed', b1[0].v === b0[0].v && b1[2].v === b0[2].v && b1[1].v < 35, b1.map(x => x.v).join('/'));
  // shift-drag changes all
  await p.keyboard.down('Shift'); await p.mouse.move(x, box.y + box.height * 0.5); await p.mouse.down(); await p.mouse.move(x, box.y + box.height * 0.5 + 1); await p.mouse.up(); await p.keyboard.up('Shift'); await p.waitForTimeout(200);
  const b2 = await bars(0); ok('Shift changes the whole step', new Set(b2.map(x => x.v)).size === 1, b2.map(x => x.v).join('/'));
  // keyboard on a single bar
  const first = p.locator(`${sec} [data-vstep="0"] .vel-note`).first(); await first.focus(); const before = (await bars(0))[0].v; await p.keyboard.press('ArrowUp'); await p.waitForTimeout(100);
  const after = await bars(0); ok('arrow keys adjust one bar', after[0].v === Math.min(100, before + 5) && after[1].v === b2[1].v, after.map(x => x.v).join('/'));
  // advanced mode too
  await p.click(`${sec} button:text-is("ADVANCED")`); await p.waitForTimeout(300);
  ok('advanced mode shows the same bars', (await bars(0)).length === 3);
  ok('no page errors', errs.length === 0, errs.join('|'));
  await b.close(); const f = results.filter(x => !x).length; console.log(f ? f + ' FAILED' : 'ALL PASSED'); process.exit(f ? 1 : 0);
})();
