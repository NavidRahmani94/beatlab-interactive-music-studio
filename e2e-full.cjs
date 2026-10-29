const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
const OUT=path.resolve(__dirname,'e2e-out'); fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true}); const URL=process.argv[2];
const results=[]; const ok=(n,c,d='')=>{results.push([c?'PASS':'FAIL',n]);console.log((c?'PASS ':'FAIL ')+n+(d?'  ['+d+']':''));};
const MOODS={happy:['electricPiano','majorPent'],chill:['softSynth','minorPent'],dark:['pluck','minor'],dreamy:['warmPad','major'],epic:['lead','minor'],playful:['bell','majorPent'],sad:['electricPiano','minor'],mystery:['bell','minor'],groovy:['bass','minorPent']};
(async()=>{
 const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:3200}}); const p=await ctx.newPage(); const errs=[];
 p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error'&&!/fonts|ERR_TUNNEL/.test(m.text()))errs.push(m.text());}); p.on('dialog',d=>d.accept());
 const status=async()=>(await p.textContent('.status')).trim();
 const sig=async()=>(await p.$$eval('.mcell.on',e=>e.map(x=>x.getAttribute('aria-label')))).join('|');
 const nOn=async()=>(await p.$$('.mcell.on')).length, nStart=async()=>(await p.$$('.mcell.on.start')).length;
 const setRange=async(sel,val)=>p.evaluate(([s,v])=>{const e=document.querySelector(s);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,String(v));e.dispatchEvent(new Event('input',{bubbles:true}));},[sel,val]);
 const exp=async(file)=>{const [d]=await Promise.all([p.waitForEvent('download',{timeout:90000}),p.click('button.export-btn')]);await d.saveAs(path.join(OUT,file));};
 const mood=async(m)=>p.click(`[aria-label="Moods"] >> text="${m.toUpperCase()}"`);
 await p.goto(URL);

 // ---------- live playback ----------
 await p.click('button.play'); await p.waitForTimeout(1800);
 ok('live: PLAYING', (await p.textContent('.indicator')).includes('PLAYING'));
 const seen=new Set(); for(let i=0;i<30;i++){(await p.$$eval('.step.current',e=>e.map(x=>x.getAttribute('aria-label')))).forEach(x=>seen.add(x.split(' ').pop()));await p.waitForTimeout(50);}
 ok('live: playhead moves', seen.size>=8, seen.size+' steps');
 // melody playhead column also highlights
 ok('melody playhead highlights a column', (await p.$$('.mcell.current')).length>0);
 // change things while playing: instrument, kit, mood, auto, master, solo
 for(const id of ['softSynth','electricPiano','pluck','warmPad','bell','lead','bass']){ await p.selectOption('select[aria-label="Melody instrument"]',id); await p.waitForTimeout(350); }
 for(const k of ['kit808','tight','classic']){ await p.selectOption('select[aria-label="Drum kit"]',k); await p.waitForTimeout(250); }
 await setRange('input[aria-label="Master reverb amount"]',70); await p.selectOption('select[aria-label="Master reverb size"]','cathedral'); await p.waitForTimeout(500);
 await p.keyboard.press('Space'); await p.waitForTimeout(300); ok('Space stops', (await p.textContent('.indicator')).includes('STOPPED'));
 for(let i=0;i<10;i++){await p.click('button.play');await p.waitForTimeout(150);await p.click('button.stop');}
 ok('10x play/stop stable, no errors', errs.length===0, errs.join(' | '));

 // ---------- MELODY: one-by-one cells ----------
 await setRange('input[aria-label="Master reverb amount"]',12); await p.selectOption('select[aria-label="Master reverb size"]','hall');
 await p.click('text=CLEAR MELODY'); ok('clear melody', (await nOn())===0);
 await p.selectOption('select[aria-label="Melody instrument"]','electricPiano');
 await p.click('button[aria-label="E4 step 3"]'); ok('1 click = exactly 1 cell (default length is one step)', (await nOn())===1);
 await p.click('button[aria-label="E4 step 3"]'); ok('click again removes it', (await nOn())===0);
 const lens=await p.$$eval('[aria-label="Note length"] button',e=>e.map(x=>x.textContent+':'+x.getAttribute('aria-pressed'))); ok('default note length button is 1 STEP', lens[0].includes('true'), lens.join(','));
 for(const m of Object.keys(MOODS)){
   await mood(m); const inst=await p.inputValue('select[aria-label="Melody instrument"]'); const sc=await p.inputValue('select[aria-label="Scale"]');
   const single=(await nOn())===(await nStart());
   ok(`mood ${m.toUpperCase()}: instrument=${MOODS[m][0]}, scale=${MOODS[m][1]}, every cell single, notes>=6`, inst===MOODS[m][0]&&sc===MOODS[m][1]&&single&&(await nStart())>=6, `${inst}/${sc}/${await nStart()} notes`);
 }
 // ---------- scale + key change the music ----------
 await mood('happy'); const s0=await sig(); const steps0=(await p.$$eval('.mcell.on',e=>e.map(x=>x.getAttribute('aria-label').split(' ').pop()))).join(',');
 await p.selectOption('select[aria-label="Scale"]','minor'); const s1=await sig(); const steps1=(await p.$$eval('.mcell.on',e=>e.map(x=>x.getAttribute('aria-label').split(' ').pop()))).join(',');
 ok('scale Major-Pent -> Minor: notes change, rhythm identical', s0!==s1 && [...new Set(steps0.split(','))].sort().join()===[...new Set(steps1.split(','))].sort().join(), s0.split('|').slice(0,3)+' => '+s1.split('|').slice(0,3));
 const rows0=await p.$$eval('.mrow:not(.mhead) .mlabel',e=>e.map(x=>x.textContent).join(','));
 await p.selectOption('select[aria-label="Key"]','7'); const rows1=await p.$$eval('.mrow:not(.mhead) .mlabel',e=>e.map(x=>x.textContent).join(','));
 ok('key C -> G: piano roll rows change', rows0!==rows1, rows0+' => '+rows1);
 await p.selectOption('select[aria-label="Key"]','0');
 // ---------- AUTO MELODY ----------
 await mood('mystery'); await p.click('button.auto-btn'); const a1=await sig(); const aSingle=(await nOn())===(await nStart());
 await p.click('button.auto-btn'); const a2=await sig();
 ok('AUTO MELODY makes notes, single cells', (await nStart())>=3&&aSingle, (await nStart())+' notes');
 ok('AUTO MELODY gives a different tune each press', a1!==a2);
 ok('AUTO MELODY stays in the scale (Easy rows only, none hidden)', !(await p.textContent('.grid-footer')).includes('OUTSIDE THIS VIEW'));
 // ---------- ADVANCED + VELOCITY ----------
 await p.click('text=ADVANCED'); ok('advanced: 37 rows (C3-C6)', (await p.$$('.mrow:not(.mhead):not(.vel-lane)')).length===37);
 await p.click('text=CLEAR MELODY'); await p.click('[aria-label="Note length"] >> text="4"'); await setRange('input[aria-label="New note velocity"]',90);
 await p.click('button[aria-label="G4 step 1"]'); await p.click('button[aria-label="B4 step 1"]'); await p.click('button[aria-label="D5 step 1"]');
 ok('advanced: chord of 3 notes, 4-step length', (await nStart())===3&&(await nOn())===12);
 ok('velocity lane shows new-note velocity 90', (await p.getAttribute('[aria-label="Velocity step 1"]','aria-valuenow'))==='90');
 const cell=await p.$('[aria-label="Velocity step 1"]'); const box=await cell.boundingBox();
 await p.mouse.move(box.x+box.width/2,box.y+box.height*0.8); await p.mouse.down(); await p.mouse.move(box.x+box.width/2,box.y+box.height*0.8); await p.mouse.up();
 const v=Number(await p.getAttribute('[aria-label="Velocity step 1"]','aria-valuenow')); ok('drag in velocity lane sets velocity (~20)', Math.abs(v-20)<=6, 'v='+v);
 await cell.focus(); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); const v2=Number(await p.getAttribute('[aria-label="Velocity step 1"]','aria-valuenow')); ok('keyboard arrows change velocity (+5 each)', v2>=v+8&&v2<=v+12, v+' -> '+v2);
 const ops=await p.$$eval('.mcell.on.start',e=>e.map(x=>getComputedStyle(x).opacity)); ok('note cells reflect velocity (opacity < 1 after lowering)', ops.every(o=>Number(o)<1), ops.join(','));
 // new-note velocity used by single-note click
 await p.click('text=CLEAR MELODY'); await p.click('[aria-label="Note length"] >> text="1"'); await setRange('input[aria-label="New note velocity"]',35); await p.click('button[aria-label="C4 step 5"]');
 ok('new note takes the "new note velocity" slider', (await p.getAttribute('[aria-label="Velocity step 5"]','aria-valuenow'))==='35');
 await p.click('text=EASY');

 // ---------- export analysis set ----------
 await p.selectOption('select[aria-label="Export length"]','2');
 await setRange('input[aria-label="Master reverb amount"]',0);
 await p.click('text=CLEAR MELODY'); await p.selectOption('select[aria-label="Melody instrument"]','electricPiano');
 await p.click('button[aria-label="MELODY solo"]');
 await setRange('input[aria-label="MELODY delay send"]',0); await setRange('input[aria-label="MELODY reverb send"]',0);
 await setRange('input[aria-label="New note velocity"]',100); await p.click('button[aria-label="G4 step 1"]'); await exp('vel100.wav');
 await p.click('text=CLEAR MELODY'); await setRange('input[aria-label="New note velocity"]',20); await p.click('button[aria-label="G4 step 1"]'); await exp('vel20.wav');
 for(const id of ['softSynth','electricPiano','pluck','warmPad','bell','lead','bass']){ await p.selectOption('select[aria-label="Melody instrument"]',id); await setRange('input[aria-label="New note velocity"]',100); await exp(`inst_${id}.wav`); }
 await p.click('button[aria-label="MELODY solo"]');
 // pan
 await p.click('button[aria-label="HI-HAT solo"]');
 for(const [pan,f] of [[-100,'hat_L.wav'],[100,'hat_R.wav']]){ await setRange('input[aria-label="HI-HAT pan"]',pan); await exp(f); }
 await p.click('button[aria-label="HI-HAT solo"]');
 // master reverb
 await p.click('button[aria-label="SNARE solo"]'); await setRange('input[aria-label="SNARE reverb send"]',0);
 await exp('snare_rev0.wav');
 for(const [size,f] of [['room','snare_room.wav'],['cathedral','snare_cath.wav']]){ await p.selectOption('select[aria-label="Master reverb size"]',size); await setRange('input[aria-label="Master reverb amount"]',60); await exp(f); }
 const st=await status(); ok('export status message mentions .wav', /Exported .*\.wav/.test(st), st);
 await setRange('input[aria-label="Master reverb amount"]',0); await p.click('button[aria-label="SNARE solo"]');
 // master volume
 await setRange('input[aria-label="Master volume"]',-30); await exp('master_m30.wav'); await setRange('input[aria-label="Master volume"]',0); await exp('master_0.wav');

 // ---------- save / open round trip keeps everything ----------
 await p.fill('input[aria-label="Project name"]','Full Test'); await mood('epic'); await setRange('input[aria-label="Master reverb amount"]',44); await p.selectOption('select[aria-label="Master reverb size"]','room'); await p.selectOption('select[aria-label="Drum kit"]','kit808');
 await setRange('[aria-label="Velocity step 1"] >> xpath=..','0').catch(()=>{});
 const [d]=await Promise.all([p.waitForEvent('download'),p.click('button:text-is("SAVE")')]); const jp=path.join(OUT,'full.beatlab.json'); await d.saveAs(jp); const saved=JSON.parse(fs.readFileSync(jp,'utf8'));
 ok('saved JSON: instrument=lead, kit=kit808, reverb 0.44/room, 8 notes with velocities', saved.melodyInstrument==='lead'&&saved.drumKit==='kit808'&&saved.master.reverbMix===0.44&&saved.master.reverbSize==='room'&&saved.melody.length===8&&saved.melody.some(n=>n.velocity!==0.8), JSON.stringify(saved.master));
 await p.click('text=CLEAR MELODY'); await mood('sad'); await p.selectOption('select[aria-label="Drum kit"]','classic');
 await p.setInputFiles('input[aria-label="Open project file"]',jp); await p.waitForTimeout(400);
 ok('open: instrument, kit, master, notes restored', (await p.inputValue('select[aria-label="Melody instrument"]'))==='lead'&&(await p.inputValue('select[aria-label="Drum kit"]'))==='kit808'&&(await p.inputValue('select[aria-label="Master reverb size"]'))==='room'&&(await nStart())===8);
 fs.writeFileSync(path.join(OUT,'bad.json'),JSON.stringify({...saved,melodyInstrument:'kazoo'})); const before=await nStart();
 await p.setInputFiles('input[aria-label="Open project file"]',path.join(OUT,'bad.json')); await p.waitForTimeout(300);
 ok('bad instrument file rejected with readable error, project untouched', /melodyInstrument/.test(await status())&&(await p.$('.status.error'))!==null&&(await nStart())===before, await status());
 const samples=await p.$$eval('select[aria-label="Load sample project"] option',e=>e.map(x=>x.value).filter(Boolean)); ok('4 sample projects offered', samples.length>=4, samples.join(', '));
 for(const s of samples){ await p.selectOption('select[aria-label="Load sample project"]',s); await p.waitForTimeout(150); }
 await p.click('button.play'); await p.waitForTimeout(900); ok('sample plays', (await p.textContent('.indicator')).includes('PLAYING')); await p.click('button.stop');
 await p.screenshot({path:path.join(OUT,'final.png'),fullPage:true});
 ok('no page errors at end', errs.length===0, errs.join(' | ')); await b.close();
 fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results)); console.log('\nSUMMARY',results.filter(r=>r[0]==='PASS').length+'/'+results.length+' passed');
})().catch(e=>{console.error('SCRIPT ERROR',e);process.exit(1);});
