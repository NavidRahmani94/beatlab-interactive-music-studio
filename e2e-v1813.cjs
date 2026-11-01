const { chromium } = require('playwright');
let fail = 0; const ok = (n, c, d = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + d)); if (!c) fail++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(process.argv[2]); await p.waitForTimeout(1200);
  const bpm = async () => Number(await p.locator('#bpm').inputValue());
  const sel = p.locator('select[aria-label="Tempo style"]');
  await sel.selectOption('house'); ok('House sets 124 BPM', await bpm() === 124, await bpm());
  await sel.selectOption('dnb'); ok('Drum & Bass sets 174 BPM', await bpm() === 174);
  await p.locator('#bpm').fill('131'); ok('moving the slider shows Custom', await sel.inputValue() === 'custom', await sel.inputValue());
  await p.locator('#bpm').fill('130'); ok('slider on 130 shows Techno', await sel.inputValue() === 'techno');
  const label = () => p.locator('.pitch > label b').textContent();
  ok('starts at A = 440.0 Hz', await label() === 'A = 440.0 Hz', await label());
  ok('reset disabled at 440', await p.locator('button[aria-label="Reset pitch"]').isDisabled());
  await p.locator('input[aria-label="Pitch in semitones"]').fill('2'); ok('+2 semitones = 493.9 Hz', await label() === 'A = 493.9 Hz', await label());
  await p.locator('button[aria-label="Pitch 432 Hz"]').click(); ok('≈432 button', /A = 431\.9 Hz/.test(await label()), await label());
  await p.locator('button[aria-label="Reset pitch"]').click(); ok('reset returns to 440', await label() === 'A = 440.0 Hz');
  await p.locator('input[aria-label="Pitch in semitones"]').fill('-3'); await p.locator('input[aria-label="Pitch in cents"]').fill('20');
  // save → reload via autosave
  await p.waitForTimeout(1500); await p.reload(); await p.waitForTimeout(1500); await p.locator('button:text-is("RESTORE IT")').click(); await p.waitForTimeout(500);
  ok('pitch survives a reload (autosave)', (await label()) === 'A = ' + (440 * Math.pow(2, (-3 + 0.2) / 12)).toFixed(1) + ' Hz', await label());
  await p.locator('.transport').screenshot({ path: 'e2e-out/v1813-transport.png' });
  ok('no page errors', errs.length === 0, errs.join('|'));
  await b.close(); console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);
})();
