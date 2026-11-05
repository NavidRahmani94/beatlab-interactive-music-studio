# Architecture (v0.6)

```
React UI  ProjectBar · Transport · Visualizer · Tabs [AMBIENT | DRUMS | MELODY | ARPEGGIO] · PlaylistPanel · MixerPanel
   │  state: patterns[], playlist[], current pattern, play mode, instruments per track, arp settings, kit, key/scale, channels, master, bpm
   ▼
project.ts ── one BeatLabProject (schemaVersion 2). validateProject on Open (version-1 files are upgraded to one pattern), serialize on Save.
   │
   ├── song.ts   PatternData {name, drums, melody, ambient, arp} · Playlist = one slot per bar (pattern index | null) · frameAt(tick) -> {bar, step, pattern}
   ├── arp.ts    arpAt(heldNotes, step, settings, tick) – pure, deterministic arpeggiator
   │
   ├── engine.ts (live)  Transport.scheduleRepeat('16n'); own tick counter -> frameAt -> Rig.triggerStep(...) + frame callback (playhead)
   └── exporter.ts (WAV) Tone.Offline + the same scheduling and the same frameAt -> Rig.triggerStep(...)
                                                    │
 4 drum voices ─┐                                  rig.ts  (one class, used by both)
 melody synth ──┤► 7 channel strips (volume, pan, mute/solo) ─┬─► MASTER IN ─► EQ3 ─► compressor ─► master reverb ─► master volume ─► limiter ─► out (+ meter, spectrum, waveform)
 ambient synth ─┤                                             ├─► reverb send bus ─┘
 arp synth ─────┘                                             └─► delay send bus (tempo-synced) ─┘
```
* **One Rig for live and export.** The same class builds the whole sound path, so the WAV sounds like what you hear.
* **Patterns and playlist.** A pattern is one bar (16 steps) of all four tracks. The playlist (1–32 bars) places patterns on bars; PATTERN mode loops the selected pattern, SONG mode walks the playlist and loops. The same pure `frameAt` function decides what plays in live mode and in the export, so they cannot disagree.
* **Notes of any length.** Melody/ambient/arp share one note model `{id, pitch, step, lengthSteps, velocity}`. The piano roll turns pointer drags into `toggleNote` (create) and `resizeNote` (stretch / shrink; clipped at the bar end and at the next note of the same pitch).
* **Arpeggio.** The arp track stores held notes (a chord drawn as long notes). `arpAt` turns whatever is held on a step into one note per 1/16 or 1/8 (Up, Down, Up-Down, Random; 1–3 octaves; gate).
* **Four tracks, one key.** Key and Scale are shared; changing them transposes / remaps every track of every pattern.
* **Timing.** Notes are scheduled on Tone's audio clock (`Transport`), never with `setInterval`. Drum hits use fixed durations in seconds so their timbre never depends on BPM.
* **Validation.** `validateProject` checks every field (ranges, 16 steps, notes inside the bar, playlist indices, known instrument/kit/reverb/delay/arp ids). Invalid files are rejected with a message and the current project is kept. Older files open with defaults.
* **Export.** Offline render (44.1 kHz stereo). SONG mode renders the playlist up to its last used bar × the chosen number of repeats; PATTERN mode renders the selected pattern for N bars. The tail depends on the master reverb size; `wav.ts` writes 16-bit PCM with clipping protection.
* **Visualiser.** Two `Tone.Analyser` nodes after the limiter (FFT + waveform) feed a canvas drawn with `requestAnimationFrame` (no React re-renders); the playlist highlights the playing bar.


## v0.14 additions
`midiFile.ts` (pure): .mid writer and strict reader (running status, velocity-0 note-offs, SMPTE rejected, size and note limits), notes → grid and GM drums → pattern. `midiLive.ts` (pure): message parsing, drum pad map, `quantizePosition`, `heldSteps`. `midiInput.ts`: Web MIDI wrapper (browser only). The Rig has `liveDown/liveUp/liveDrum`, which use the same voices as the song and start slightly later while the transport runs (Tone refuses events in the past). `MidiPanel.tsx` is the UI; App owns the recording logic.

## v0.13 additions
`groove.ts` (pure): `drumHits(drums, step, tick, groove)` returns the hits of a step (own hits + ghost notes + fills, with delay and velocity), `swingDelay`, `stepDrift`, and a hash-based `rand(tick, salt)`. The Rig calls them in `triggerStep`, so live play and export are identical. `groove` is a field of the project (optional in the file, default straight).

## v0.12 additions
`chords.ts` (pure): diatonic chords from key + scale (pentatonic uses the parent 7-note scale), voicing/inversion kept inside C2–C7, block/strum/arp placement, merge into a track, next-chord suggestions, progressions. `ChordBuilder.tsx` is the UI inside `TrackPanel`.

## v0.11 additions
- `history.ts` (pure): `commit / undo / redo` on `{past, future}` lists of whole-project snapshots (max 100). `autosave.ts`: localStorage wrapper that never throws.
- App commits a snapshot 500 ms after the last change (`flushHistory`), restores with `setAll`. Autosave waits until the restore question is answered.

## v0.10 additions – dynamic tracks (schema 5)
- `tracks.ts` (pure): `TrackDef {id,name,kind,instrument,arp}`, kinds melody|ambient|arp|synth, add/remove/rename helpers, max 8 tracks, reserved ids (`drums`, `lab`, drum names, `__proto__`…).
- `PatternData.notes: Record<trackId, MelodyNote[]>` (empty tracks have no entry, see `compactNotes`). `channels` has the 4 drum channels plus one per track (`syncChannels`).
- `Rig.setTracks(defs)` builds one voice per track; arpeggio settings come from each arp track. The same Rig is used for live play and offline export.
- `project.ts#toV5` converts schema 1–4 files before validation.
- App: `view` is `'drums' | trackId | 'lab'`; `SynthPanel` embeds the piano roll of the Synth track bound to the selected synth.

## v0.9 additions

- `synth.ts` (pure): `SynthPatch` model, limits, `validatePatch`/`clampPatch`/`randomPatch`, the library `FACTORY_SOUNDS` (patch data per instrument) and the helpers for the project's `synths` list (`synth:<id>` references).
- `patchSynth.ts`: `PatchSynth` = polyphonic voice pool (osc1 + osc2 + noise -> filter -> amp envelope -> tremolo -> drive -> chorus -> volume). Sources only run while a note sounds. It captures the audio context at construction because voices are created lazily during playback (in the offline export the global context has already changed by then).
- `rig.ts`: `setSynths()`, instrument resolution (built-in PolySynth sounds, library patch, or the user's patch), a signature per voice so a track is rebuilt when its patch changes, and an extra audition voice for the Synth Lab keyboard. `engine.ts` forwards `setSynths` and `auditionDown/Up/Stop`; `exporter.ts` calls `rig.setSynths(project.synths)` before building the tracks.
- `project.ts`: schema 4 (`synths`), tracks may reference `synth:<id>`, version-3 files still open; seven demo songs.
- `theme.ts` + CSS variables in `main.css` (dark default, `[data-theme=light]` overrides); a tiny script in `index.html` sets the theme before the first paint.

## v0.15 additions
`arrangement.ts` is pure: slot operations (move/copy/clear/insert/remove), section helpers, `autoSections`, `STRUCTURES`, `guessRoles`, `buildStructure`. Sections are labels only and never affect audio. `PlaylistPanel` uses HTML5 drag & drop.

## v0.16 additions
`vizMath.ts` is pure (band energies from the FFT, loudness, `BeatPulse` onset detector). `Visualizer.tsx` draws all styles on one canvas with requestAnimationFrame; no React re-renders per frame.

## v0.16.1
`Rig.buildHat` renders one hat hit per kit in a private OfflineContext (synchronously switching the global Tone context, like patchSynth). Falls back to the MetalSynth until the buffer exists.

## v0.17 additions
`keyboardPiano.ts` (pure key mapping, octave, step cursor). App: keyboard listeners feed the same `onMidi` path as a real MIDI keyboard; `previewNote` for the note names; `stepCursor` for step entry. `toneFix.ts`: Tone context with latencyHint playback + lookAhead 0.15, and a timer-based dispose of finished one-shot sources.

## v0.17.1
`PianoRoll` Row is memoised on a per-row signature; playhead class set imperatively; `useInView` pauses HeroArt/Visualizer when off screen; LITE flag in localStorage `beatlab.lite.v1`.

## v0.17.2
`toneFix.ts` also records the owning Tone.Oscillator of each one-shot node and cuts the frequency/detune link when it ends. `pinVoices` in rig.ts. `Engine.getHealth()` counts steps whose callback ran after their own start time (raw context clock).

## v0.18 additions
`timeline.ts` (pure seconds/steps maths), `Timeline.tsx` (playhead moved on the DOM by requestAnimationFrame), `engine.seek(step)` (sets the tick counter; `startTick` for PLAY). Startup project now has sections too.

## v0.18.3 additions
`rig.ts`: master chain ends limiter → `safety` (WaveShaper with `softClip`, 2x oversampling) → destination; meters tap `safety`. `getHealth` (engine) and the CLIP counter (Visualizer) are diagnostics only.

## v0.18.4
Removed `maxPolyphony` caps from `makeVoice` (Tone drops new notes over the cap, it does not steal a voice).

## v0.18.5
`patchSynth.ts`: voices with a pulse/PWM oscillator get a 20 Hz high-pass (`dcb`) between the filter and the amp envelope. `synth.ts`: `volumeDb` of 18 factory sounds lowered (measured by rendering each sound offline).

## v0.18.6 — mixer follows the tracks, PAN is a knob
- The mixer always has exactly one channel per track (plus the 4 drum channels). A safety sync now runs whenever the track list changes (add, delete, load, undo), and a row is never hidden because its channel is missing.
- PAN is now a rotary knob (`PanKnob.tsx`): drag up/right = right, down/left = left, arrow keys (Shift = bigger step), Home = centre, End = hard right, double-click = centre. It is a `role="slider"` with the same label as before (`<track> pan`).
- Checked in a real browser (`e2e-v186.cjs`): adding Synth/Arpeggio tracks adds channels, renaming and deleting update the mixer, NEW project resets it. Not checked: by ear that every channel strip changes the sound as expected.

## v0.18.7 — bolder type, prominent section headers
- Section headers (MIXER, DRUMS, PLAYLIST ...) are now 17 px bold Space Grotesk with an accent bar and a soft highlighted background; their hint text on the right stays small. MASTER, mixer group names, channel names, tabs and buttons are bolder too, and the small grey mono labels are bigger and darker. Pure CSS: no behaviour changed.
- Looked at in a desktop screenshot only; the phone layout (<700 px) has its own smaller header rule and was not viewed on a real phone.

## v0.18.8 — Fun Sized heading font
- The logo, the big intro title, every section header (PROJECT, MIXER ...), MASTER and the mixer group names use the **Fun Sized** font (`FunSized.woff2`, loaded by `funsized.css`; since v0.22.2 it is a separate file so it is cached and does not block the CSS — a hand-made single-file build must inline it again). It only has capital letters and digits; any other symbol falls back to Space Grotesk. Small text keeps the readable fonts.
- Licence: Fun Sized is CC BY-NC 4.0 (Xerographer Fonts / Max Infeld): **non-commercial use only and credit required**. The credit is in the footer and the licence text is `FunSized-LICENSE.txt`. Using BeatLab commercially would need a licence from the designer.

## v0.18.9 — Dat Box interface font (test)
- New header button **Aa DAT BOX / Aa FONT** switches the interface text (labels, tabs, buttons, mixer names, hints) between the normal fonts and the **Dat Box** font. It is ON by default in this test build and the choice is remembered. Headings keep Fun Sized.
- Dat Box has capitals, lowercase and digits only, and its scribble boxes make small text hard to read, so this is for judging the look, not necessarily for keeping.
- Licence: CC BY-NC 4.0 (Xerographer Fonts / Max Infeld), non-commercial only, credit in the footer, licence text in `DatBox-LICENSE.txt`.

## v0.18.10 — Dat Box removed
- The Dat Box interface-font test (v0.18.9) was judged not good (small text unreadable) and was removed completely: button, CSS, font file and licence. Fun Sized stays for headings.

## v0.18.11 — Fun Sized only on the hero title
- Fun Sized is now used only for the big "Make some noise." title. The logo, section headers (MIXER, PROJECT ...), MASTER and mixer groups are back to the bold Space Grotesk look of v0.18.7.

## v0.18.12 — footer removed
- The footer line (version, "built with", "audio unverified by ear", font credit) was removed from the page. The version is still shown in the header. The Fun Sized credit required by its CC BY-NC 4.0 licence now lives here and in `FunSized-LICENSE.txt`: *Fun Sized by Xerographer Fonts / Max Infeld*.

## v0.18.13 — tempo styles and global pitch
- **STYLE** menu under the tempo slider (Ballad 68 … Drum & Bass 174): picking one sets the tempo; moving the slider by hand shows "Custom" (or the style that has exactly that tempo).
- **PITCH** control next to the tempo: KEY slider (−12…+12 semitones) and FINE slider (−50…+50 cents), the current A frequency ("A = 440.0 Hz"), a "≈ 432 Hz" button (−32 cents, shows 431.9) and RESET 440. Double-click a slider to zero it.
- It moves every track and every Synth Lab sound, the on-screen/MIDI live notes and the Synth Lab keyboard, and it is part of Export WAV/MP3. **Drums are not changed.** It is saved in the project (`tuning`; old files without it load as 440) and in the autosave. Not part of undo/redo.
- Checked: unit tests (`tuning.test.ts`), real offline render in the browser (note A4 measured 440 → 440 Hz, "432" → 432 Hz, +2 semitones → 494 Hz), e2e `e2e-v1813.cjs`. Not checked: by ear, and the live (non-export) path while holding keys and changing the pitch at the same moment (a key held across a pitch change may keep ringing until released).

## v0.18.14 — channel effects and slide notes
- **Effects per mixer channel**: every channel (drums and tracks) has an **FX** button; open it to add up to 4 effects that run in a row (before pan and the reverb/delay sends): Chorus, Phaser, Flanger, Tremolo, Vibrato, Distortion, Bitcrusher, Auto-Filter, Auto-Wah, Stereo Widener. Each has an amount (0 = off sound), an ON/OFF bypass, a remove button and move up/down. Saved in the project (`channels.<id>.fx`), part of Export. An effect only costs CPU while it exists. Moving a knob does not rebuild the chain; adding, removing, reordering, bypassing or changing a type does (a tiny click is possible if you do that while the song plays).
- **Slide notes** (`slide: true` on a note): a SLIDE lane under the velocity lane (not on arpeggio tracks). A note with slide on bends its pitch over its own length toward the pitch of the next note of the same track (up to ±2 octaves) — the next note is still played normally. Works on the Synth Lab sounds and on the built-in instruments (through a small hook on the PolySynth voice). Not exported to MIDI files.
- Checked: unit tests (`fx.test.ts`), real offline renders in the browser (all 10 effects change the sound, no silence/NaN; a slide note rises across its length, a plain one stays flat), e2e `e2e-v1814.cjs`, `e2e-v1814b.cjs`. Not checked: by ear, how nice each effect sounds, CPU use with 4 effects on every channel, and the hook on every one of the factory instruments (tested on electricPiano and sawLead).

## v0.18.15 — slide fix, system monitor
- **Slide fix**: slide notes did nothing on every Synth Lab / factory sound that has a pitch LFO (vibrato: violin, flute, clarinet, oboe, sax, square lead, FM lead, …). Cause: that LFO is wired into the oscillator's detune, and Tone ignores scheduled ramps on a signal that has an input. The patch synth now ramps the FREQUENCY instead. A slide note with no later note to glide to shows a red SLIDE button (nothing to slide to).
- **STATS button** (header) opens a small System monitor: AUDIO LOAD and AUDIO GLITCHES (Chrome's own render-capacity numbers, n/a in other browsers), AUDIO CLOCK (how close to 100% of real time the audio clock runs; lower = the audio thread is starving = crackling), LATE STEPS, PAGE SPEED (fps), PAGE LAG (timer lateness = main thread busy) and MEMORY (JS heap, Chrome/Edge only). Real per-core CPU % is not available to web pages.
- Where the cost is (offline render of the Hip Hop demo on the slow sandbox, relative): melodic tracks ≈ 53 %, master + send reverbs ≈ 13 %, drums, delay, EQ and compressor ≈ 2–4 % each; 4 effects on every track doubled it (Phaser +49 %, Stereo Widener +45 %, Auto-Wah +30 %, Tremolo +27 %, Flanger +25 %, Chorus +19 %, Auto-Filter +19 %, Vibrato +12 %, Distortion +6 %, Bitcrusher ≈ 0 %, each on 4 tracks). Numbers are from a software-only machine; your computer will be much faster, the proportions are what matters.
- Checked: pitch tracking of 25 instruments with and without slide (live and offline), e2e `e2e-v1815.cjs`, all earlier e2e. Not checked: the monitor in Firefox/Safari, and by ear.

## v0.18.16 — monitor without the unsupported rows
- AUDIO LOAD and AUDIO GLITCHES come from the browser's AudioContext.renderCapacity API. It does not exist in the Chromium used for testing (Chrome 153 build) and may be missing in other browsers or versions, so those two rows are now hidden when the browser gives no data. A new AUDIO HEALTH row (OK / BORDERLINE / STRAINED) sums up AUDIO CLOCK, LATE STEPS and PAGE LAG and works everywhere.

## v0.18.17 — slide notes work like FL Studio (a slide note is silent and bends the sounding note)
- A slide note (the ⤴ button under a note) now makes NO sound itself. Place it where another note is still sounding (or ends exactly where the slide note starts): that note's pitch glides, over the slide note's own length, to the slide note's pitch and then stays there until the slide note ends. Slide notes one after another continue the glide. A slide note with nothing sounding under it is played as a normal note (its button is dimmed).
- Checked with real offline renders (electricPiano, sawLead, plus earlier 7-instrument checks of the glide itself): a held C4 with a C5 slide note glides 263 → 317 → 474 Hz and there is no new attack at the slide note. 301 unit tests. Not checked: by ear. MIDI export ignores slides.
- **Fix:** the slide flag was lost every time another note was added, removed or transposed (the note list was rebuilt without it). Now it is kept (new unit test + `e2e-v1817.cjs` clicks it in the real piano roll).

## v0.18.18 — signal meters (left / right) on every mixer channel
- Each mixer channel now has a "SIGNAL L / R" column: two small level bars (green → yellow → red, with a peak tick) that move while the music plays and sit still when stopped. They are tapped AFTER the channel's effects, pan and mute, so a hard-panned channel shows signal only on its own side, and a muted channel shows nothing. Implemented with a `Tone.Split` + two `Tone.Meter` per strip (`Rig.getChannelLevels`), drawn straight on the DOM each frame (no React re-render).
- Also fixed the mixer row layout so the value labels (dB / %) no longer overlap the next slider.
- Checked in a real browser (`e2e-v1817b.cjs`): all channels have meters, they are empty when stopped, move during play, and with the kick panned hard left the L bar moves while R stays at 0. Looked at a screenshot of the mixer. Not checked: on a phone.

## v0.18.19 — the channel meters now cost (almost) nothing
- A user report showed AUDIO HEALTH "STRAINED" (AUDIO CLOCK 73%). Measured in the sandbox with the same offline render: the new L/R channel meters of v0.18.18 added about 1.5 % audio-thread time. Not the cause of a 27 % drop by themselves, but they are now only connected while the mixer is on screen, the tab is visible and the music is playing (`Rig.setMetering`, IntersectionObserver + visibilitychange), and they are drawn at about 30 fps in a layout-contained box. Exports never have them connected.
- `e2e-v1817b.cjs` checks: meters idle when the mixer is off screen, moving when it is visible, hard-left pan → only L moves.
- Not known: what exactly made the audio clock fall on the user's computer. Suggested checks: other heavy tabs/apps, power-saving mode, and whether it happens with the mixer scrolled away or with FX removed.

## v0.18.20 — AUDIO CLOCK in the system monitor is averaged (no more false "STRAINED")
- A user screenshot showed AUDIO HEALTH "STRAINED" at AUDIO CLOCK 96.2 % with 0 late steps, 3 ms page lag and 131 fps: that is not a real overload. Browsers move the audio clock in chunks, so a single 1-second reading can be a few percent low. The clock is now the average of the last ~8 s (needs 3 readings, so "…" for the first seconds); BORDERLINE below 97 %, STRAINED below 90 % (before: 99.5 / 97). A real starvation (like the 73 % seen earlier) still shows.
- Not known: whether the earlier 73 % reading was a real glitch of the user's computer. The engine itself was measured in the sandbox only.

## v0.18.21 — octaves in EASY mode
- EASY piano roll: new **OCTAVE − / +** selector in each track (shows which octave of the key you write in: from 2 octaves below the middle one to 1 above). Notes in other octaves keep playing; the "N NOTES OUTSIDE THIS VIEW STILL PLAY" hint tells you.
- New **MOVE ALL NOTES ▼ OCT / ▲ OCT**: moves every note of the track by an octave (disabled when a note would leave the range; notes are never wrapped around).
- Note range widened from C3–C6 to **C2–C7** (MIN_MIDI 36, MAX_MIDI 96). Older saved projects load unchanged. ADVANCED shows the full range. The MIDI import folds notes into the new range (test updated).
- Checked: 303 unit tests, `e2e-v1821.cjs` in a real browser (rows move by 12, the hint, the moved note appears in the octave above, selector hidden in ADVANCED). Not checked: by ear. The CHORD BUILDER still places chords in its own register (it switches to ADVANCED if they fall outside the EASY view).

## v0.19.0 — AIR CONTROL: control BeatLab with your hands (camera, beta)
- New panel **AIR CONTROL**. The camera is OFF until the person clicks the switch; the instructions (what each hand gesture does, each with a tick box) are shown before and, next to the camera picture, while it is on. Switching off stops the camera and the model.
- How it works: the camera picture is analysed in the browser by MediaPipe **Hand Landmarker** (21 points per hand, `handTracker.ts`); nothing is sent or saved. The library (`@mediapipe/tasks-vision@0.10.21`, from jsDelivr) and the model (~8 MB, from Google storage) are downloaded only when the switch is turned on, so the offline standalone file keeps working without them. First use needs internet; camera needs https:// or localhost.
- Gestures are decided from the landmarks (`handGestures.ts`, pure and unit-tested): open palm, fist, thumb up / down, index up, victory, L-shape, OK sign. `handControl.ts` (pure, injected clock) turns them into actions: ✋ hold = PLAY · ✊ hold = STOP · 👍/👎 tempo ±1 repeating · ☝️ hand height = master volume · 👆👍 L opening = master treble (brightness) · second hand (left) open palm height = reverb · fast flat-hand swipe = next / previous pattern (switches to PATTERN mode) · ✌️ hold 1 s = mute / unmute the open track (drums tab: the four drums) · 👌 OK sign = AIR PIANO (note by left ↔ right from the key + scale, 2 octaves, volume by height, played with the open track's sound).
- Safety: gestures have to be held ~0.5 s, a moving palm restarts the hold, a swipe never starts the music, continuous controls wait 0.25 s; every function can be unticked (saved in the browser).
- Tests: `hand.test.ts` (16, synthetic hands incl. rotation / size), `e2e-v190.cjs` (fake camera + fake tracker: panel, camera on/off, play, tempo, volume, stop, mute, untick, camera released).
- **Not tested here:** the real MediaPipe model with a real hand (this sandbox has no camera and cannot reach the CDN), so thresholds may need tuning from real use. The panel shows the recognised gesture live to help with that.

## v0.19.1 — AIR CONTROL: only PLAY / STOP for now
- First real test by the user: PLAY (open palm) and STOP (fist) worked well, the other gestures (tempo, volume, brightness, reverb, patterns, mute, air piano) did not. So the panel now offers only PLAY / STOP. The code of the others stays in `handControl.ts` (`ALL_HAND_FEATURES` / `EXPERIMENTAL_FEATURES`) and in the unit tests, switched off, so they can be fixed one by one later with real feedback.
- Tests: `hand.test.ts` (17; new: other gestures do nothing by default), `e2e-v190.cjs` updated (thumb up does nothing, play / stop / untick, camera released).

## v0.19.2 — computer-keyboard piano keeps working after touching a slider or list
- Bug: the piano keys (A W S E D F …) were ignored whenever ANY input, slider or drop-down had focus, e.g. after moving the volume / tempo slider or choosing an instrument, until the person clicked somewhere else. Now only real text fields (names, number boxes) block the keys (`isTypingTarget` in `keyboardPiano.ts`, unit-tested). With a drop-down focused, a piano key no longer jumps to a list entry, so it cannot change the instrument by accident.
- Checked in a real browser with real key presses and an audio tap (`e2e-v192.cjs`): keys play on the melody tab, with the instrument list focused (instrument unchanged), with a slider focused, not in a text field, and as drum pads on the DRUMS tab. A MIDI hardware keyboard was also simulated (fake Web MIDI input): notes, chords, drums, note-off, channel 6, active-sensing / pedal / pitch-bend messages all work (`midikbd.cjs`); the CONNECT KEYBOARD button is inside the collapsed 🎹 MIDI panel (click "▸ 🎹 MIDI" first).
- Not tested: a real hardware keyboard.

## v0.19.3 — piano keys work with any keyboard layout (Persian, Arabic, Russian …)
- Bug: the computer-keyboard piano read the typed LETTER (`event.key`). With a Persian (or other non-Latin) layout the A key types "ش", so no key matched and the piano was silent, even with KEYBOARD PIANO ON. Now the PHYSICAL key is used (`event.code`, `pianoKey()` in `keyboardPiano.ts`), the same keys as on a US keyboard (A W S E D F T G Y H U J K, Z / X for the octave, A S D F = drum pads). The letter is used only as a fallback when the browser gives no code.
- Tests: unit tests for `pianoKey`; `e2e-v193.cjs` sends key events as a Persian layout does (key "ش", code "KeyA"): melody and drum pads play, a non-piano key stays silent, the US layout still works.
- Not tested: a real Persian keyboard layout (key events were created with the same key/code pair the browser reports).

## v0.19.4 — code explained in simple English (no behaviour change)
- For the international team: every source file now starts with a `// FILE:` line that says in simple English what the file is for. Long or difficult comments (mainly in `rig.ts`, `App.tsx`, `PianoRoll.tsx`, `project.ts`, `patchSynth.ts`, `SystemMonitor.tsx`) were rewritten with short sentences and common words, and one outdated comment in `song.ts` was corrected.
- New **CODE_GUIDE.md**: what BeatLab is, how to run and test it, how the parts work together, the rules for the code, one line per file, and the words used in the code (step, pattern, track, strip, rig, patch, slide note).
- Only comments and documents were changed. Checked by compiling every file with all comments removed and comparing with the previous version: 76 files, 0 code differences. Unit tests and browser tests were run again.

## v0.20.0 — SHAPE LAB
- `shapePhysics.ts`: pure physics (World, balls, wall and ball bounces, hit events with a 0.12 s gap per pair, `pitchFor`, `velocityFor`, `speedForBpm`). No graphics, fully unit tested.
- `shapeScene.ts`: three.js drawing (box lines, sphere meshes, flash on hit, pulse, picking and drag plane). Only used by the panel.
- `ShapeLab.tsx`: the panel, the loop, mouse handling. App passes `notes` (same list as AIR PIANO), `bpm`, `keyPc`, `pulseKey` (changes on each kick step), `onNote`.
- Notes are played with `previewNote(track, midi, down, velocity)` on the open melody track (200 ms long). They are live notes: they are not written into the song.
- Test hook: `window.__BEATLAB_SHAPELAB__ = { world, scene }` while the panel is open.

## v0.20.1 — fixed-length live notes
`Rig.liveShot(track, note, seconds, velocity)` uses `triggerAttackRelease`. Use it for any live note whose end is known in advance. `liveDown`/`liveUp` are only for keys that are really held. Note: Tone's PolySynth gives every attack its own voice but a release frees only one voice of that pitch, so an attack must not be repeated without its own release.

## v0.21.0 — SHAPE LAB v2
- `shapeMusic.ts`: pure rules: `chordNotes` (stacked thirds inside the scale rows), `chordName`, `tickEvents(layer, progression, tick, rows)`, patterns and presets, `noteSeconds`.
- `shapeScene.ts`: three.js: one view per shape, spheres at the corners (height = pitch), sprites with note names and the chord name.
- `ShapeLab.tsx`: panel, two clocks (synced to `songStep`, or a 10 ms interval when the song is stopped), builders. Notes go out through `onNote(midi, velocity, seconds)` → `Rig.liveShot`.
- `shapePhysics.ts` (balls) was removed. Test hook: `window.__BEATLAB_SHAPELAB__ = { scene, log, shown }` (log has the tick, the time and the notes of every event).

## v0.21.1
- `Rig.setShapeVoices([{instrument, volumeDb}])` / `Rig.shapeShot(i, note, seconds, velocity)`: one voice + one Volume per shape, straight into `masterIn` (no strip, no sends, not part of the offline render). `makeVoice(def, to?)` got an optional output node.
- `BeatLabEngine` stores the shape sounds, so they are applied whenever the Rig is created. `App` keeps them in `shapeVoicesRef` for the same reason (child effects run before parent effects).
- `shapeToPatterns(layer, progression, rows)` in `shapeMusic.ts`: pure; one list of notes per 32-step pattern. `App.onShapeConvert` makes the track and writes the notes (`addTrack`, `withNotes`, `addPattern`).

## v0.22.1
`App` keeps `liveNotes` (state, list of MIDI notes sounding now), set by `onMidi` (keyboard and MIDI both go through it), by the keyboard `keydown` handler (immediately, before the audio engine is ready) and by `previewNote`. It goes `TrackPanel` → `PianoRoll` (`liveNotes`) → `Row` (`live` prop, part of the memo comparison, so only changed rows redraw).

## v0.22.0
`Rig.makeVoice` uses `WorkletSynth` for every live voice (tracks, shape voices) when engine 2 is loaded and the context is not an `OfflineContext` (`isOfflineContext()`), so `Tone.Offline` (export) keeps `PatchSynth`/Tone. Basic instruments come from `legacyPatches.ts`. Slide notes: `glide` points are sent with the note; the worklet interpolates cents between points.

## v0.21.3
Sound engine 2: `voiceWorklet.js` (AudioWorkletProcessor `beatlab-synth`, up to 24 voices, notes arrive as messages `{t:'note', id, start, dur, freq, vel}` with an audio-clock start time, `rel` for held keys) loaded by `workletSynth.ts` (`loadWorklet` via a Blob URL from the `?raw` import, so it also works in the single-file build; uses `rawContext.audioWorklet.addModule` because Tone keeps only the first module of a context). `Rig.makeVoice` uses `WorkletSynth` only for SHAPE LAB voices (`maxRelease` set) when the worklet is loaded; everything else (tracks, export, offline rendering) stays on `PatchSynth` / Tone.

## v0.21.2
- `audioMode.ts`: `configureAudio()` makes the Tone context with a `latencyHint` (FAST `interactive`, SMOOTH `playback`, SAFE 0.08 s) before the first sound node; `audioStart()` replaces `Tone.start()`. Tone's own `lookAhead` stays 0.1 s. The mode is in localStorage `beatlab.audiomode` and is read once per page load.
- `Rig.makeVoice(def, to?, maxRelease?)`: shape voices use a release of at most `SHAPE_MAX_RELEASE` (0.45 s). Tone.PolySynth sounds get it through `capRelease`, patch sounds through a copied patch.
- `PatchSynth.steals` / `PatchSynth.maxVoices`: diagnostics for the voice limit.
- The first key of the keyboard piano waits for `engine.prepare()`; a key released before that gets a 180 ms note.
