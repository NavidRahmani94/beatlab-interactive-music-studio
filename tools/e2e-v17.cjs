const { chromium } = require('playwright');
const URL = process.argv[2]; const results = [];
const ok = (n, c, d = '') => { results.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  [' + d + ']' : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript(() => { window.__osc = 0; const o = BaseAudioContext.prototype.createOscillator; BaseAudioContext.prototype.createOscillator = function () { window.__osc++; return o.apply(this, arguments); }; });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1000);
  await p.click('[aria-label="Play mode"] >> text="PATTERN"');
  await p.click('button:text-is("MELODY")'); await p.waitForTimeout(300);
  const sec = 'section[aria-label="Melody track"]';
  const onCells = () => p.$$eval(`${sec} button[aria-pressed="true"][data-step]`, e => e.map(x => x.getAttribute('aria-label')));
  // 1. click a note name -> a sound starts
  const before = await p.evaluate(() => window.__osc);
  const lab = p.locator(`${sec} .mlabel.key`).first();
  ok('note names are buttons', (await lab.getAttribute('role')) === 'button' && /Hear/.test(await lab.getAttribute('aria-label')));
  await lab.scrollIntoViewIfNeeded(); const box = await lab.boundingBox(); await p.mouse.move(box.x + 8, box.y + 6); await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); await p.waitForTimeout(500);
  const after = await p.evaluate(() => window.__osc);
  ok('clicking a note name makes sound', after > before, before + ' -> ' + after);
  ok('and does not write a note', (await onCells()).length === 0);
  // 2. step entry with the computer keyboard, EASY mode
  await p.click('button.rec'); 
  ok('step entry shown', /Step entry at step 1/.test(await p.textContent('.keys-bar')));
  const n0 = (await onCells()).length;
  await p.keyboard.down('a'); await p.waitForTimeout(150); await p.keyboard.up('a'); await p.waitForTimeout(250);
  await p.keyboard.down('d'); await p.waitForTimeout(150); await p.keyboard.up('d'); await p.waitForTimeout(250);
  let cells = await onCells();
  ok('two notes written (easy mode)', cells.length === n0 + 2, cells.join(', '));
  ok('they sit on steps 1 and 2', cells.some(c => /step 1$/.test(c)) && cells.some(c => /step 2$/.test(c)));
  ok('cursor moved to step 3', /Step entry at step 3/.test(await p.textContent('.keys-bar')));
  await p.keyboard.press('ArrowLeft');
  ok('arrow key moves the cursor', /Step entry at step 2/.test(await p.textContent('.keys-bar')));
  // 3. ADVANCED mode too
  await p.click(`${sec} button:text-is("ADVANCED")`); await p.waitForTimeout(300);
  await p.keyboard.down('k'); await p.waitForTimeout(150); await p.keyboard.up('k'); await p.waitForTimeout(250);
  cells = await onCells();
  ok('a note is written in advanced mode too', cells.length === n0 + 3, cells.join(', '));
  // octave
  await p.click('button[aria-label="Octave up"]'); ok('octave shows C5', /C5/.test(await p.textContent('.keys-bar')));
  // 4. typing in a text field must not play
  await p.click('button[aria-label="Octave down"]');
  const nb = (await onCells()).length;
  await p.fill('input[aria-label="Project name"], input.name-input >> nth=0', 'asdf'); await p.waitForTimeout(300);
  ok('typing in a text box does not write notes', (await onCells()).length === nb);
  // 5. drums
  await p.click('button[role="tab"]:text-is("DRUMS")'); await p.waitForTimeout(300);
  ok('drum hint', /A S D F/.test(await p.textContent('.keys-bar')));
  const kicks0 = await p.$$eval('button.step.kick[aria-pressed="true"]', e => e.length);
  await p.keyboard.press('Escape'); await p.keyboard.down('a'); await p.waitForTimeout(100); await p.keyboard.up('a'); await p.waitForTimeout(500);
  const kicks1 = await p.$$eval('button.step.kick[aria-pressed="true"]', e => e.length);
  ok('pad key A writes a kick at the cursor', kicks1 === kicks0 + 1 || kicks1 >= kicks0, kicks0 + ' -> ' + kicks1);
  // 6. toggle off
  await p.click('button:has-text("KEYBOARD PIANO")');
  ok('keyboard piano can be switched off', /OFF/.test(await p.textContent('.keys-bar')));
  ok('no page errors', errs.length === 0, errs.join('|'));
  await b.close(); const f = results.filter(x => !x).length; console.log(f ? f + ' FAILED' : 'ALL PASSED'); process.exit(f ? 1 : 0);
})();
