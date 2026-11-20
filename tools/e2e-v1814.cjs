const { chromium } = require('playwright');
let fail = 0; const ok = (n, c, d = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + d)); if (!c) fail++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(process.argv[2]); await p.waitForTimeout(1200);
  await p.locator('button[aria-label="MELODY effects"]').click();
  const add = p.locator('select[aria-label="Add effect to MELODY"]');
  ok('starts with no effects', await p.locator('.mix-fx .fx-slot').count() === 0);
  await add.selectOption('chorus'); await add.selectOption('distortion'); await add.selectOption('bitcrusher');
  ok('three effects added', await p.locator('.mix-fx .fx-slot').count() === 3);
  ok('button shows the count', /FX 3/.test(await p.locator('button[aria-label="MELODY effects"]').innerText()));
  await p.locator('button[aria-label="Move Bitcrusher up"]').click();
  const types = async () => p.locator('.mix-fx .fx-slot select').evaluateAll(s => s.map(x => x.value));
  ok('reorder works', (await types()).join() === 'chorus,bitcrusher,distortion', (await types()).join());
  await p.locator('select[aria-label="MELODY effect 1 type"]').selectOption('phaser'); ok('change type', (await types())[0] === 'phaser');
  await p.locator('input[aria-label="MELODY effect 2 amount"]').fill('80');
  ok('amount shown', (await p.locator('.fx-slot').nth(1).locator('b').innerText()) === '80%');
  await p.locator('button[aria-label="MELODY effect 3 on"]').click(); ok('bypass toggles', await p.locator('button[aria-label="MELODY effect 3 bypassed"]').count() === 1);
  await add.selectOption('widener'); ok('max 4 reached disables add', await add.isDisabled());
  await p.locator('.mixer').screenshot({ path: 'e2e-out/v1814-fx.png' });
  await p.locator('button[aria-label^="Remove Bitcrusher"]').click(); ok('remove works', await p.locator('.fx-slot').count() === 3);
  // plays with effects without errors
  await p.locator('button.play').click(); await p.waitForTimeout(2500); await p.locator('button.stop').click();
  await p.locator('button:text-is("NEW")').click(); await p.waitForTimeout(400);
  ok('NEW project: no effects button count', !/FX \d/.test(await p.locator('button[aria-label="MELODY effects"]').innerText()));
  ok('no page errors', errs.length === 0, errs.join('|'));
  await b.close(); console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);
})();
