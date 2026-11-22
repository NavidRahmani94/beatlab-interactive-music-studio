// v0.24.0: INSPECT mode. A click on any part of the page shows the file and line of its code, what it runs and how the file connects. Nothing is played or changed while it is on.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await (await b.newContext({ viewport: { width: 1280, height: 1100 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  let bad = 0; const ok = (n, c, d) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + (d || ''))); if (!c) bad++; };
  await p.goto(process.argv[2]); await p.waitForTimeout(1500);
  const playing = async () => (await p.getByRole('button', { name: 'Stop (quick)' }).count()) > 0;
  const panel = p.locator('.insp-panel');
  ok('inspect is off at the start', (await panel.count()) === 0);
  ok('elements carry file and line', (await p.locator('[data-src]').count()) > 100);
  await p.getByRole('button', { name: 'Inspect mode', exact: true }).click(); await panel.waitFor({ timeout: 8000 });
  ok('the panel opens with one click on INSPECT', (await panel.count()) === 1);
  // 1. click the quick play button: the code is shown, nothing plays
  await p.getByRole('button', { name: 'Play (quick)' }).click(); await p.waitForTimeout(500);
  let txt = await panel.innerText();
  ok('click shows the file and line (App.tsx)', /src\/App\.tsx:\d+/.test(txt), txt.slice(0, 200));
  ok('shows what the click runs', /RUNS/.test(txt) && /onClick=/.test(txt), txt.slice(0, 400));
  ok('shows what the file does', /WHAT THIS FILE DOES/.test(txt) && /main page/i.test(txt));
  ok('shows the files it uses and who uses it', /THIS FILE USES/.test(txt) && /audio\/engine\.ts/.test(txt) && /react/.test(txt));
  ok('the click did not start playback', !(await playing()));
  // 2. a slider is not moved by a click
  const range = p.locator('input[type=range]').first(); const v0 = await range.inputValue(); const bb = await range.boundingBox();
  await p.mouse.click(bb.x + bb.width * 0.9, bb.y + bb.height / 2); await p.waitForTimeout(300);
  ok('a click on a slider does not move it', (await range.inputValue()) === v0);
  txt = await panel.innerText(); ok('and shows where that slider is made', /src\/[\w/]+\.tsx:\d+/.test(txt), txt.slice(0, 120));
  // 3. click through the folders: a panel from the UI folder
  await p.locator('[role=tab]:has-text("LEAD")').first().click({ force: true }).catch(() => {}); await p.waitForTimeout(300);
  // 4. clicking a file name in the lists jumps to that file
  const chip = panel.locator('.insp-chip[title^="src/audio/"]').first();
  if (await chip.count()) { const name = (await chip.innerText()); await chip.click(); await p.waitForTimeout(200); const t2 = await panel.innerText(); ok('a file name in the list opens that file', t2.includes('src/' + name), t2.slice(0, 150)); ok('a test file is listed where one exists', /TESTS/.test(t2)); }
  // 5. hover highlight and tag
  await p.mouse.move(640, 400); await p.waitForTimeout(250); ok('hover draws a box with file:line', (await p.locator('.insp-box .insp-tag').count()) >= 1);
  // 6. leave with Escape; the page works normally again
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok('Escape leaves inspect mode', (await panel.count()) === 0 && !(await p.evaluate(() => document.body.classList.contains('insp-on'))));
  await p.getByRole('button', { name: 'Play (quick)' }).click(); await p.waitForTimeout(800); ok('the page works normally again (play starts)', await playing());
  await p.getByRole('button', { name: 'Stop (quick)' }).click(); await p.waitForTimeout(400);
  // 7. toggle again with the button
  await p.getByRole('button', { name: 'Inspect mode', exact: true }).click(); await panel.waitFor(); await p.getByRole('button', { name: 'Inspect mode', exact: true }).click(); await p.waitForTimeout(300);
  ok('the INSPECT button also switches it off', (await panel.count()) === 0);
  ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));
  console.log(bad ? bad + ' FAILED' : 'ALL PASS'); await b.close(); process.exit(bad ? 1 : 0);
})();
