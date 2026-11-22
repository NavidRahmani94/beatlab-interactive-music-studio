// v0.25.0: LINK mode in the piano roll: drag an arrow from one note to a later note
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await (await b.newContext({ viewport: { width: 1280, height: 1300 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  let bad = 0; const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  await p.goto(process.argv[2]); await p.waitForTimeout(1200);
  await p.locator('[role=tab]:has-text("LEAD")').first().click(); await p.waitForTimeout(400);
  const roll = p.locator('.roll').first();
  // start from an empty roll
  for (let i = 0; i < 40; i++) { const on = roll.locator('.mcell.on.start').first(); if (!(await on.count())) break; await on.click(); await p.waitForTimeout(30); }
  ok('the roll starts empty', (await roll.locator('.mcell.on').count()) === 0);
  const cell = (midiIdx, step) => roll.locator('.mrow:not(.mhead):not(.vel-lane):not(.slide-lane)').nth(midiIdx).locator('.mcell').nth(step);
  await cell(6, 0).click(); await cell(2, 8).click(); await p.waitForTimeout(200);
  ok('two notes are placed', (await roll.locator('.mcell.on.start').count()) === 2);
  ok('no arrow yet', (await roll.locator('.link-svg line').count()) === 0);
  await p.locator('.link-btn').first().click(); await p.waitForTimeout(150);
  ok('LINK mode shows its help line', (await p.locator('.link-help').count()) === 1);
  // clicking an empty cell in LINK mode does not add a note
  await cell(4, 4).click(); await p.waitForTimeout(150);
  ok('an empty click adds nothing in LINK mode', (await roll.locator('.mcell.on.start').count()) === 2);
  ok('five link styles to choose from', (await p.locator('.roll-tools .seg button').count()) === 5);
  await p.locator('.roll-tools .seg button', { hasText: 'LONG' }).click();
  const a = await cell(6, 0).boundingBox(), c = await cell(2, 8).boundingBox();
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down(); await p.mouse.move((a.x + c.x) / 2, (a.y + c.y) / 2, { steps: 5 }); await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 5 });
  ok('a dashed arrow follows the pointer while dragging', (await roll.locator('.link-svg line.band').count()) === 1);
  await p.mouse.up(); await p.waitForTimeout(250);
  ok('the arrow is drawn between the notes', (await roll.locator('.link-svg line:not(.band)').count()) === 1);
  ok('the second note is a glide (slide) note', (await roll.locator('.mcell.on.slide').count()) > 0);
  ok('the first note was stretched up to the second', (await roll.locator('.mcell.on:not(.slide)').count()) >= 8);
  ok('the arrow shows its style', (await roll.locator('.link-svg text').first().textContent()) === 'LONG');
  await p.screenshot({ path: process.argv[3] || '/tmp/link.png', clip: (await roll.boundingBox()) });
  // a click on the glided note takes the link away
  await cell(2, 8).click(); await p.waitForTimeout(250);
  ok('clicking the glided note removes the link', (await roll.locator('.link-svg line').count()) === 0 && (await roll.locator('.mcell.on.slide').count()) === 0);
  await p.locator('.link-btn').first().click(); await p.waitForTimeout(150);
  ok('LINK mode is off again', (await p.locator('.link-help').count()) === 0);
  // PLAY and THIS PATTERN right above the roll
  const tools = p.locator('.roll-tools').first();
  ok('PLAY and THIS PATTERN sit in the bar right above the roll', (await tools.locator('.mini-play').count()) === 2);
  await tools.locator('.mini-play.pat').click(); await p.waitForTimeout(800);
  ok('THIS PATTERN above the roll starts playing only this pattern', (await tools.locator('.mini-play.pat.on').count()) === 1);
  await tools.locator('.mini-play.pat').click(); await p.waitForTimeout(500);
  ok('and stops again', (await tools.locator('.mini-play.pat.on').count()) === 0);
  await tools.locator('.mini-play:not(.pat)').click(); await p.waitForTimeout(800);
  ok('PLAY above the roll starts the song', (await tools.locator('.mini-play.on').count()) >= 1);
  await tools.locator('.mini-play:not(.pat)').click(); await p.waitForTimeout(500);
  ok('and stops it', (await tools.locator('.mini-play.on').count()) === 0);
  ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));
  console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
})();
