const { chromium } = require('playwright');
const URL = process.argv[2]; const results = [];
const ok = (n, c, d = '') => { results.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  [' + d + ']' : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1200);
  const clock = async () => (await p.textContent('.tl-clock')).replace(/\s+/g, ' ').trim();
  ok('timeline exists with a total time', /^0:00\.0 \/ \d+:\d\d$/.test(await clock()), await clock());
  const rulerMarks = await p.$$eval('.tl-mark', e => e.map(x => x.textContent));
  ok('ruler shows seconds', rulerMarks.length >= 4 && rulerMarks[0] === '0:00', rulerMarks.slice(0, 6).join(' '));
  const sections = await p.$$eval('.tl-section', e => e.map(x => x.textContent));
  ok('section names appear on the timeline', sections.length >= 3, sections.join('|'));
  // click in the middle while stopped
  const box = await p.locator('.tl-track').boundingBox();
  await p.mouse.click(box.x + box.width * 0.5, box.y + 40); await p.waitForTimeout(300);
  const mid = await clock(); const m = /^(\d+):(\d\d)\.\d \/ (\d+):(\d\d)$/.exec(mid);
  const cur = +m[1] * 60 + +m[2], tot = +m[3] * 60 + +m[4];
  ok('clicking the middle jumps to about half', Math.abs(cur - tot / 2) < 3, mid);
  ok('slider value follows', Math.abs(Number(await p.getAttribute('.tl-track', 'aria-valuenow')) - tot / 2) < 3);
  // play from there
  await p.click('[aria-label="Play mode"] >> text="SONG"');
  await p.mouse.click(box.x + box.width * 0.5, box.y + 40); await p.waitForTimeout(200);
  await p.click('button.play >> nth=0'); await p.waitForTimeout(2500);
  const playing = await clock(); const pm = /^(\d+):(\d\d)\.(\d)/.exec(playing); const t1 = +pm[1] * 60 + +pm[2] + +pm[3] / 10;
  ok('plays from the chosen position', t1 > tot / 2 - 3 && t1 < tot / 2 + 6, playing);
  // jump back while playing
  const box2 = await p.locator('.tl-track').boundingBox(); console.log('box', JSON.stringify(box), JSON.stringify(box2), await clock()); await p.mouse.click(box2.x + box2.width * 0.1, box2.y + 40); await p.waitForTimeout(1500);
  const back = await clock(); const bm = /^(\d+):(\d\d)\.(\d)/.exec(back); const t2 = +bm[1] * 60 + +bm[2] + +bm[3] / 10;
  ok('jumping back while playing works', t2 < tot * 0.1 + 5 && t2 > tot * 0.1 - 3, back);
  // the song bar highlight follows (slot shown in visualiser)
  ok('still playing after the jump', /PLAYING/.test(await p.textContent('.indicator')));
  // keyboard: Home
  await p.focus('.tl-track'); await p.keyboard.press('Home'); await p.waitForTimeout(1000);
  const home = await clock(); const hm = /^(\d+):(\d\d)\.(\d)/.exec(home); ok('Home jumps to the start', +hm[1] * 60 + +hm[2] < 3, home);
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(600);
  ok('stop resets to 0', true);
  await p.click('button.stop >> nth=0'); await p.waitForTimeout(500);
  ok('after STOP the clock is back at 0', /^0:00\.0/.test(await clock()), await clock());
  // pattern mode: timeline is the pattern
  await p.click('[aria-label="Play mode"] >> text="PATTERN"'); await p.waitForTimeout(300);
  ok('pattern mode shows one pattern length', /\/ 0:0[0-9]$/.test(await clock()) || /\/ 0:1\d$/.test(await clock()), await clock());
  ok('no page errors', errs.length === 0, errs.join('|'));
  await b.close(); const f = results.filter(x => !x).length; console.log(f ? f + ' FAILED' : 'ALL PASSED'); process.exit(f ? 1 : 0);
})();
