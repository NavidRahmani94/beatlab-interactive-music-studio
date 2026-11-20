const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(process.argv[2]); await p.waitForTimeout(1200);
  const panel = p.locator('section.shape'); await panel.locator('.hand-switch').click(); await p.waitForTimeout(500); await panel.scrollIntoViewIfNeeded();
  console.log('buttons', await p.locator('button:has-text("PLAY")').count(), await p.locator('button:has-text("PLAY")').first().innerText());
  await p.locator('.transport-controls button').first().click(); await p.waitForTimeout(1500);
  console.log('after click', await p.locator('.transport-controls button').first().innerText());
  const s = []; for (let i = 0; i < 60; i++) { s.push(await p.evaluate(() => { const m = [...window.__BEATLAB_SHAPELAB__.scene.meshes.values()][0]; return +m.scale.x.toFixed(3) + '/' + m.position.y.toFixed(1); })); await p.waitForTimeout(40); }
  console.log(s.join(' ')); await b.close();
})();
