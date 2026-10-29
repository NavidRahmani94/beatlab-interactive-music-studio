const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
const OUT=path.resolve(__dirname,'e2e-out'); fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true}); const URL=process.argv[2];
const results=[]; const ok=(n,c,d='')=>{results.push([c?'PASS':'FAIL',n]);console.log((c?'PASS ':'FAIL ')+n+(d?'  ['+d+']':''));};
(async()=>{
 const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:1000}}); const p=global.pg=await ctx.newPage(); const errs=global.errs=[];
 p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error'&&!/fonts|ERR_TUNNEL/.test(m.text()))errs.push(m.text());}); p.on('dialog',d=>d.accept());
 const status=async()=>(await p.textContent('.status')).trim();
 const nOn=async()=>(await p.$$('.mcell.on')).length, nStart=async()=>(await p.$$('.mcell.on.start')).length;
 const rowOn=async(note)=>(await p.$$(`button.mcell.on[aria-label^="${note} step"]`)).length;
 const setRange=async(sel,val)=>p.evaluate(([s,v])=>{const e=document.querySelector(s);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,String(v));e.dispatchEvent(new Event('input',{bubbles:true}));},[sel,val]);
 const exp=async(file)=>{const [d]=await Promise.all([p.waitForEvent('download',{timeout:120000}),p.click('button.export-btn')]);await d.saveAs(path.join(OUT,file));};
 const tab=async(t)=>p.click(`button[role="tab"]:text-is("${t}")`);
 const center=async(label)=>{const el=await p.$(`button[aria-label="${label}"]`);await el.scrollIntoViewIfNeeded();const bb=await el.boundingBox();return {x:bb.x+bb.width/2,y:bb.y+bb.height/2};};
 const drag=async(from,to)=>{const a=await center(from),c=await center(to);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move((a.x+c.x)/2,(a.y+c.y)/2,{steps:4});await p.mouse.move(c.x,c.y,{steps:4});await p.mouse.up();};
 const sel=async(label,val)=>p.selectOption(`select[aria-label="${label}"]`,val);
 await p.goto(URL);

 // ---------- structure ----------
 const tabs=await p.$$eval('button[role="tab"]',e=>e.map(x=>x.textContent.trim()));
 ok('four tabs: AMBIENT, DRUMS, MELODY, ARPEGGIO', JSON.stringify(tabs)===JSON.stringify(['AMBIENT','DRUMS','MELODY','ARPEGGIO']), tabs.join(','));
 ok('melody tab is shown first', (await p.$('section[aria-label="Melody track"]'))!==null);
 ok('visualiser, playlist and mixer are on the page', (await p.$('canvas.viz-canvas'))!==null&&(await p.$('section[aria-label="Patterns and playlist"]'))!==null&&(await p.$('section.mixer'))!==null);
 const mixerNames=await p.$$eval('.mix-row .instrument-name',e=>e.map(x=>x.textContent.trim().replace(/M?$/,'')));
 ok('mixer has 7 channels', mixerNames.length===7, mixerNames.join(','));
 ok('mixer groups: DRUMS, MELODY, AMBIENT, ARPEGGIO', JSON.stringify(await p.$$eval('.mix-group',e=>e.map(x=>x.textContent)))===JSON.stringify(['DRUMS','MELODY','AMBIENT','ARPEGGIO']));
 for(const l of ['Master EQ low','Master EQ mid','Master EQ high','Master compressor','Master volume','Master reverb amount']) ok('master control: '+l, (await p.$(`input[aria-label="${l}"]`))!==null);

 // ---------- drums unchanged ----------
 await tab('DRUMS');
 ok('drums: kit select, 4 rows x 16 steps', (await p.$$('.instrument-row .step')).length===64&&(await p.$('select[aria-label="Drum kit"]'))!==null);
 const k1=await p.getAttribute('button[aria-label="kick step 2"]','aria-pressed'); await p.click('button[aria-label="kick step 2"]'); ok('drums: step toggles', (await p.getAttribute('button[aria-label="kick step 2"]','aria-pressed'))!==k1); await p.click('button[aria-label="kick step 2"]');
 await p.click('button[aria-label="HI-HAT on"]'); ok('drums: per-instrument OFF button', (await p.getAttribute('button[aria-label="HI-HAT off"]','aria-pressed'))==='false'); await p.click('button[aria-label="HI-HAT off"]');

 // ---------- melody: click, drag-create, drag-stretch, shrink, remove ----------
 await tab('MELODY'); await p.click('text=CLEAR MELODY'); ok('melody cleared', (await nOn())===0);
 await p.click('button[aria-label="E4 step 3"]'); ok('click = one cell', (await nOn())===1);
 await p.click('button[aria-label="E4 step 3"]'); ok('click on it removes it', (await nOn())===0);
 await drag('E4 step 3','E4 step 8'); ok('drag across empty cells = one long note (6 steps)', (await rowOn('E4'))===6&&(await nStart())===1, String(await rowOn('E4')));
 await drag('E4 step 8','E4 step 11'); ok('drag the end of a note to the right stretches it (9 steps)', (await rowOn('E4'))===9&&(await nStart())===1, String(await rowOn('E4')));
 await drag('E4 step 11','E4 step 6'); ok('drag back shrinks it (4 steps: 3..6)', (await rowOn('E4'))===4, String(await rowOn('E4')));
 await drag('E4 step 6','E4 step 16'); ok('stretch is clipped at the end of the bar (14 steps: 3..16)', (await rowOn('E4'))===14, String(await rowOn('E4')));
 ok('long note is drawn connected (one start, one end)', (await p.$$('.mcell.on.start')).length===1&&(await p.$$('.mcell.on.end')).length===1);
 await p.click('button[aria-label="E4 step 10"]'); ok('plain click on a long note removes the whole note', (await nOn())===0);
 await drag('G4 step 5','G4 step 5'); ok('click-sized drag on empty cell makes a 1-step note', (await nOn())===1);
 await p.click('text=CLEAR MELODY');
 await p.keyboard.press('Tab'); // keyboard path: focus a cell and press Enter
 await p.focus('button[aria-label="C4 step 1"]'); await p.keyboard.press('Enter'); ok('keyboard: Enter on a focused cell adds a note', (await nOn())===1);
 await p.keyboard.press('Enter'); ok('keyboard: Enter again removes it', (await nOn())===0);
 await p.click('[aria-label="Moods"] >> text="SAD"'); ok('mood SAD loads notes + instrument', (await nStart())>=6&&(await p.inputValue('select[aria-label="Melody instrument"]'))==='electricPiano');
 await p.click('button.auto-btn'); const a1=(await p.$$eval('.mcell.on',e=>e.map(x=>x.getAttribute('aria-label')))).join('|'); await p.click('button.auto-btn'); const a2=(await p.$$eval('.mcell.on',e=>e.map(x=>x.getAttribute('aria-label')))).join('|');
 ok('AUTO MELODY differs each press', a1!==a2);
 const inst=await p.$$eval('select[aria-label="Melody instrument"] option',e=>e.map(x=>x.value)); ok('11 instruments offered (incl. strings, airPad, glassPad, drone)', inst.length===11&&['strings','airPad','glassPad','drone'].every(i=>inst.includes(i)), inst.join(','));
 await p.click('text=ADVANCED'); ok('advanced: 37 piano-roll rows', (await p.$$('.mrow:not(.mhead):not(.vel-lane)')).length===37);
 await p.click('text=EASY');

 // ---------- ambient ----------
 await tab('AMBIENT'); ok('ambient: default instrument is Warm Pad', (await p.inputValue('select[aria-label="Ambient instrument"]'))==='warmPad');
 ok('ambient: empty by default', (await nOn())===0);
 await p.click('button[aria-label="C4 step 1"]'); ok('ambient: one click makes a long (8-step) note', (await nOn())===8, String(await nOn()));
 await p.click('[aria-label="Ambient presets"] >> text="SHIMMER"'); ok('ambient: ready-made SHIMMER loads long notes + glassPad', (await nStart())>=4&&(await p.inputValue('select[aria-label="Ambient instrument"]'))==='glassPad');
 ok('ambient: has no AUTO MELODY / moods', (await p.$('button.auto-btn'))===null);

 // ---------- arpeggio ----------
 await tab('ARPEGGIO'); ok('arp: default instrument is Pluck', (await p.inputValue('select[aria-label="Arpeggio instrument"]'))==='pluck');
 for(const g of ['Arpeggio direction','Arpeggio speed','Arpeggio octaves']) ok('arp control: '+g, (await p.$(`[aria-label="${g}"]`))!==null);
 ok('arp: gate slider', (await p.$('input[aria-label="Arpeggio gate"]'))!==null);
 await p.click('[aria-label="Arpeggio presets"] >> text="MINOR CHORD"'); ok('arp: ready-made chord = 3 long notes', (await nStart())===3&&(await nOn())===48, (await nStart())+' notes');
 await p.click('[aria-label="Arpeggio direction"] >> text="UP-DOWN"'); ok('arp: direction button selected', (await p.getAttribute('[aria-label="Arpeggio direction"] >> text="UP-DOWN"','aria-pressed'))==='true');

 // ---------- patterns + playlist ----------
 await p.click('button[aria-label="New pattern"]'); await p.click('button[aria-label="New pattern"]');
 let chips=await p.$$eval('[aria-label="Patterns"] .chip',e=>e.map(x=>x.textContent)); ok('new pattern x2 -> 3 patterns', chips.length===3, chips.join(','));
 ok('new pattern is blank and selected', (await nOn())===0&&(await p.inputValue('input[aria-label="Pattern name"]'))==='Pattern 3');
 await p.fill('input[aria-label="Pattern name"]','Chorus'); ok('rename pattern', (await p.$$eval('[aria-label="Patterns"] .chip',e=>e.map(x=>x.textContent))).includes('Chorus'));
 await p.click('button[aria-label="Select pattern Pattern 1"]'); ok('select pattern shows its own notes (arp chord there)', (await nStart())===3);
 await p.click('button[aria-label="Duplicate pattern"]'); ok('duplicate copies the notes', (await nStart())===3&&(await p.$$('[aria-label="Patterns"] .chip')).length===4);
 await p.click('button[aria-label="Delete pattern"]'); ok('delete removes pattern', (await p.$$('[aria-label="Patterns"] .chip')).length===3);
 ok('playlist starts with 1 bar', (await p.$$('.slot')).length===1);
 for(let i=0;i<7;i++) await p.click('button[aria-label="Add bar"]'); ok('+BAR x7 -> 8 bars', (await p.$$('.slot')).length===8);
 await p.click('button[aria-label="Select pattern Pattern 1"]'); await p.click('button[aria-label^="Playlist bar 2 "]'); await p.click('button[aria-label^="Playlist bar 3 "]');
 await p.click('button[aria-label="Select pattern Pattern 2"]'); await p.click('button[aria-label^="Playlist bar 4 "]');
 const slotText=await p.$$eval('.slot',e=>e.map(x=>x.querySelector('span').textContent)); ok('paint bars with the selected pattern', slotText[1]==='Pattern 1'&&slotText[2]==='Pattern 1'&&slotText[3]==='Pattern 2', slotText.join(','));
 await p.click('button[aria-label^="Playlist bar 4 "]'); ok('click a bar with the same pattern clears it', (await p.$$eval('.slot',e=>e.map(x=>x.className))).slice(3,4)[0].includes('empty'));
 for(let i=0;i<7;i++) await p.click('button[aria-label="Remove bar"]'); ok('−BAR shrinks (min 1 bar)', (await p.$$('.slot')).length===1);

 // ---------- full song sample, song-mode playback, visualiser ----------
 await p.selectOption('select[aria-label="Load sample project"]','Full Song'); await p.waitForTimeout(200);
 ok('Full Song: 3 patterns, 8 bars', (await p.$$('[aria-label="Patterns"] .chip')).length===3&&(await p.$$('.slot')).length===8);
 await p.click('button[aria-label="Select pattern Groove"]'); await tab('DRUMS'); const kicks=(await p.$$('.step.enabled.kick')).length; await tab('AMBIENT'); const amb=await nStart(); await tab('ARPEGGIO'); const arpN=await nStart(); await tab('MELODY'); const mel=await nStart();
 ok('Full Song uses all four tracks', kicks>0&&amb>0&&arpN>0&&mel>=0, `kick=${kicks} amb=${amb} arp=${arpN} mel=${mel}`);
 await p.click('[aria-label="Play mode"] >> text="SONG"'); await setRange('#bpm',200);
 const blank=await p.evaluate(()=>{const c=document.querySelector('canvas.viz-canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]>200)n++;return n;});
 await p.click('button.play'); const bars=new Set(), pats=new Set(); let maxLit=0;
 for(let i=0;i<60;i++){ await p.waitForTimeout(120);
   const pl=await p.$$eval('.slot.playing',e=>e.map(x=>x.getAttribute('aria-label'))); pl.forEach(x=>bars.add(x.split(' ')[2]));
   const lit=await p.evaluate(()=>{const c=document.querySelector('canvas.viz-canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]>200)n++;return n;}); maxLit=Math.max(maxLit,lit); }
 ok('song mode: playhead walks through >=5 different playlist bars', bars.size>=5, [...bars].join(','));
 ok('visualiser draws while playing (much more lit pixels than idle)', maxLit>blank*2, `idle=${blank} playing max=${maxLit}`);
 ok('visualiser label shows bar/step', /BAR \d+ \/ 8/.test(await p.textContent('.viz .panel-label')), await p.textContent('.viz .panel-label'));
 ok('indicator PLAYING', (await p.textContent('.indicator')).includes('PLAYING'));
 await p.click('button.stop'); ok('stop clears playhead', (await p.$$('.slot.playing')).length===0);
 await p.click('[aria-label="Play mode"] >> text="PATTERN"'); await p.click('button.play'); await p.waitForTimeout(1200); ok('pattern mode plays', (await p.textContent('.indicator')).includes('PLAYING')); await p.click('button.stop');
 for(let i=0;i<8;i++){await p.click('button.play');await p.waitForTimeout(120);await p.click('button.stop');}
 ok('no page errors so far', errs.length===0, errs.join(' | '));

 // ---------- mixer & master ----------
 await setRange('input[aria-label="AMBIENT volume"]',-12); await p.click('button[aria-label="ARPEGGIO solo"]'); await p.click('button[aria-label="ARPEGGIO solo"]');
 await setRange('input[aria-label="Master EQ low"]',6); await setRange('input[aria-label="Master compressor"]',40);
 ok('master EQ + compressor values show', /\+6 dB/.test(await p.textContent('.master-grid')) && /40%/.test(await p.textContent('.master-grid')));
 await setRange('input[aria-label="Master EQ low"]',0); await setRange('input[aria-label="Master compressor"]',0);

 // ---------- save / open / legacy ----------
 await p.fill('input[aria-label="Project name"]','Song Test');
 const [d]=await Promise.all([p.waitForEvent('download'),p.click('button:text-is("SAVE")')]); const jp=path.join(OUT,'song.beatlab.json'); await d.saveAs(jp); const saved=JSON.parse(fs.readFileSync(jp,'utf8'));
 ok('saved JSON v2: 3 patterns, 8-bar playlist, 4 tracks, arp, EQ', saved.schemaVersion===2&&saved.patterns.length===3&&saved.playlist.length===8&&saved.tracks.ambient&&saved.arp.mode&&'eqLow' in saved.master, JSON.stringify(saved.playlist));
 await p.selectOption('select[aria-label="Load sample project"]','Basic House Beat');
 await p.setInputFiles('input[aria-label="Open project file"]',jp); await p.waitForTimeout(300);
 ok('open: patterns and playlist restored', (await p.$$('[aria-label="Patterns"] .chip')).length===3&&(await p.$$('.slot')).length===8);
 const legacy={schemaVersion:1,name:'Old v0.5',bpm:110,stepsPerBar:16,bars:1,drums:saved.patterns[1].drums,melody:saved.patterns[1].melody,channels:Object.fromEntries(['kick','snare','hat','clap','melody'].map(k=>[k,{volumeDb:0,muted:false,reverbSend:0,delaySend:0}])),melodyInstrument:'bell',melodyView:{key:9,scale:'minor'}};
 fs.writeFileSync(path.join(OUT,'legacy.json'),JSON.stringify(legacy)); await p.setInputFiles('input[aria-label="Open project file"]',path.join(OUT,'legacy.json')); await p.waitForTimeout(300);
 ok('old v0.5 file opens as one pattern', (await p.$$('[aria-label="Patterns"] .chip')).length===1&&(await p.inputValue('input[aria-label="Project name"]'))==='Old v0.5'&&/Opened/.test(await status()), await status());
 fs.writeFileSync(path.join(OUT,'bad.json'),JSON.stringify({...saved,playlist:[9]})); await p.setInputFiles('input[aria-label="Open project file"]',path.join(OUT,'bad.json')); await p.waitForTimeout(300);
 ok('bad playlist rejected with readable error', /playlist/.test(await status())&&(await p.$('.status.error'))!==null, await status());
 const samples=await p.$$eval('select[aria-label="Load sample project"] option',e=>e.map(x=>x.value).filter(Boolean)); ok('5 sample projects', samples.length===5, samples.join(', '));
 for(const s of samples){ await p.selectOption('select[aria-label="Load sample project"]',s); await p.waitForTimeout(100); await p.click('button.play'); await p.waitForTimeout(500); await p.click('button.stop'); }
 ok('every sample plays', errs.length===0, errs.join(' | '));

 // ---------- exports for audio analysis ----------
 await p.selectOption('select[aria-label="Load sample project"]','Full Song'); await p.waitForTimeout(150);
 await p.click('[aria-label="Play mode"] >> text="SONG"'); await setRange('#bpm',96);
 await exp('song.wav'); ok('song export status', /song, 8 bars/.test(await status()), await status());
 await p.click('[aria-label="Play mode"] >> text="PATTERN"'); await p.click('button[aria-label="Select pattern Groove"]'); await exp('groove_pattern.wav'); ok('pattern export status', /pattern, 1 bar/.test(await status()), await status());
 // solo each new track for analysis (song mode, 1 loop)
 await p.click('[aria-label="Play mode"] >> text="SONG"');
 for(const [ch,f] of [['AMBIENT','solo_ambient.wav'],['ARPEGGIO','solo_arp.wav'],['MELODY','solo_melody.wav']]){ await p.click(`button[aria-label="${ch} solo"]`); await exp(f); await p.click(`button[aria-label="${ch} solo"]`); }
 // instrument level set: melody solo, one long note
 await setRange('input[aria-label="Master reverb amount"]',0); await tab('MELODY'); await p.click('text=CLEAR MELODY');
 await p.click('[aria-label="Play mode"] >> text="PATTERN"'); await p.click('button[aria-label="Select pattern Intro"]'); await p.click('text=CLEAR MELODY');
 await p.click('button[aria-label="MELODY solo"]'); await setRange('input[aria-label="MELODY reverb send"]',0); await setRange('input[aria-label="MELODY delay send"]',0);
 await p.click('[aria-label="Note length"] >> text="8"'); await setRange('input[aria-label="New note velocity"]',100);
 await p.click('button[aria-label="E4 step 1"]');
 for(const id of ['softSynth','electricPiano','pluck','warmPad','bell','lead','bass','strings','airPad','glassPad','drone']){ await sel('Melody instrument',id); await exp(`inst_${id}.wav`); }
 await p.screenshot({path:path.join(OUT,'final.png'),fullPage:true});
 ok('no page errors at end', errs.length===0, errs.join(' | ')); await b.close();
 fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results)); console.log('\nSUMMARY',results.filter(r=>r[0]==='PASS').length+'/'+results.length+' passed');
})().catch(async e=>{try{await global.pg.screenshot({path:'e2e-out/fail.png'});console.log('URL',global.pg.url(),'HTML',(await global.pg.content()).length);}catch(x){console.log('shot failed',String(x).slice(0,200));}console.error('SCRIPT ERROR',String(e).slice(0,300),'PAGE ERRORS:',(global.errs||[]).join(' || ').slice(0,1500));process.exit(1);});
