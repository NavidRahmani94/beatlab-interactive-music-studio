const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('dialog', d => d.accept());
  await p.goto(process.argv[2] || 'http://localhost:5199/'); await p.waitForTimeout(1500);
  const rows = async () => (await p.locator('.mixer .mix-row:not(.mix-head) .instrument-name').allInnerTexts()).map(s => s.trim());
  const tabs = async () => (await p.locator('[role=tab]').allInnerTexts()).map(s => s.trim());
  console.log('start', await rows(), await tabs());
  const add = async k => { await p.locator('button[aria-label="Add track"]').click(); await p.locator(`button[aria-label="Add ${k} track"]`).click(); await p.waitForTimeout(200); };
  await add('Synth'); await add('Arpeggio'); await add('Melody');
  console.log('after add', await rows());
  await p.locator('button[aria-label^="Delete track"]').click(); await p.waitForTimeout(200);
  console.log('after delete', await rows(), await tabs());
  await p.locator('input[aria-label="Track name"]').fill('Bassline'); await p.waitForTimeout(200);
  console.log('after rename', await rows());
  // new project
  await p.locator('button:text-is("NEW")').click(); await p.waitForTimeout(500);
  console.log('after NEW', await rows(), await tabs());
  // samples
  const sel = p.locator('select[aria-label*="ample" i]'); console.log('samples', await sel.count());
  if (await sel.count()) { const opts = await sel.first().locator('option').allInnerTexts(); console.log(opts); for (let i = 1; i < Math.min(opts.length, 8); i++) { await sel.first().selectOption({ index: i }); await p.waitForTimeout(500); console.log(opts[i], await rows(), await tabs()); } }
  await b.close();
})();
