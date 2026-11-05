# BeatLab — project status (resume file)
Version 0.7.0 · saved 29 Oct 2026

## What exists
React + TypeScript + Vite + Tone.js, no backend, **all files in one flat folder** (must stay flat).
Four tabs (Ambient, Drums, Melody, Arpeggio), 7 mixer channels → one master (EQ, compressor, reverb, delay, limiter),
notes drawn/stretched by dragging, patterns (1 bar = 16 steps) + playlist (max 32 bars), PATTERN/SONG play modes,
per-pattern ▶, SOLO per instrument/track, sticky quick-play bar, visualiser, Save/Open (schemaVersion 2, v0.5 files upgrade),
WAV export (song or pattern), startup demo song, phone layout (≤700 px), GitHub Pages workflow, standalone single-file build.

## Checks done
122 unit tests, 72-check browser test (before the latest small UI additions), WAV analysis, phone emulation at 390/360 px.
NOT done: listening test by a human, Firefox/Safari, real phone, ACTAM course brief comparison.

## Open ideas (not built)
1. Raise the playlist limit above 32 bars (small change: MAX_BARS in song.ts + tests).
2. Patterns with variable length (1–4 bars / 16–64 steps, drums too) — larger change across model, validation, engine, exporter, UI.
3. Autosave in the browser (the app only saves when you press SAVE).
4. Re-run the full browser test (e2e-full.cjs) after the latest UI additions and update it for the new SOLO / quick-play buttons.

## How to continue in a new chat
Attach this zip and say: "Continue BeatLab from PROJECT_STATUS.md". Keep the flat layout; do not claim features are tested unless run.

## v0.8.0 (latest)
- Patterns are now **32 steps** (scrollable, playhead-following); playlist up to **64 slots**.
- Export formats: WAV 16-bit, WAV 24-bit, MP3 192 / 320 kbps (`exporter.ts`, `mp3.ts`, `wav.ts`).
- Default demo is **Hip Hop Demo** (90 BPM, A minor, 808 kit; Intro/Verse/Hook/Break, 16 slots).
- Schema 3: v1/v2 files (16-step) are upgraded automatically by tiling to 32 steps.
- Touch mode toggle for drawing notes on phones.
- Verified: 127 unit tests; WAV (89.9 s, peak -4 dB, intro/break quieter than verse/hook) and MP3 192 header/duration of the demo export in headless Chromium. NOT verified: human listening, real phone, WAV24/MP3 320 in browser, e2e-full.cjs (still the v0.6 script; needs updating for 32 steps).

## v0.14.0 (latest)
MIDI: live keyboard, record, .mid import/export. Tested with a simulated keyboard, not real hardware. Next planned: Arrangement drag & drop, Interactive Visuals.

## v0.13.0
Drum Groove Engine + hi-hat bug fix. Known: exporting a long song (about 85 s of audio) took more than 4 minutes on a 2-core test machine.

## v0.12.0
Smart Chord Builder. Before it: v0.11 Undo/Redo + Autosave.

## v0.11.0
Undo / Redo and Autosave. Next planned, in this order: Arrangement drag & drop, Visuals, Sample Library.

## v0.10.0
Dynamic tracks: synth note track, rename / add / delete tracks, schema 5 with automatic upgrade. Verified by unit tests, 19 browser checks and a WAV export; not heard by ear, not tried on a real phone. Live recording from the Synth Lab keyboard is not done.

## v0.9.0
- **Light / dark / auto theme** (button top-right, remembered in the browser). All colours are CSS variables at the top of `main.css`; `theme.ts` holds the logic.
- **81 built-in melodic sounds in 12 families** (`synth.ts` → `FACTORY_SOUNDS`, plus the 11 older ones) incl. Persian santur / tar / kamancheh / ney / oud; **11 drum kits** (`rig.ts` → `KITS`).
- **Synth Lab** tab (`SynthPanel.tsx`): 2 oscillators (+FM, unison, pulse/PWM, noise), filter + envelope, amp envelope, LFO (vibrato / wobble / tremolo), drive, chorus, on-screen + computer keyboard, scope. Up to 16 synths per project, saved in the file (`synths`, schema 4), selectable on Melody/Ambient/Arpeggio as `synth:<id>`. Every library sound is also a patch and can be opened in the lab.
- Audio engine for patches: `patchSynth.ts` (`PatchSynth`, shared by live playback and the offline export). Remember: it must create its nodes in the context captured at construction (the offline export bug fixed in this version).
- 6 more demo songs: Lo-Fi Chill, House 124, Trap 140, Persian Mood, Synthwave 108, Chiptune 150 (startup song is still the Hip Hop Demo).
- Tests: 175 unit tests; `e2e-v09.cjs` (34 checks: theme, instrument menu, Synth Lab flow, save/open, delete fallback, export with a custom synth, phone fit) and `e2e-demos.cjs` (exports each demo and prints status; analyse the WAVs with numpy).
- Level calibration of the library: each sound was rendered offline and its volume set so the loudness is about the same (target -21 dB RMS).
- NOT verified: listening by ear (sounds are synthesized imitations, e.g. santur/ney are not recordings), real phone, MP3 320 / WAV24 in the browser, `e2e-full.cjs` (old v0.6 script, not updated).
- Ideas not done: more drum rows (open hat, toms, rim, crash), per-sound effects sends, sample import.

- v0.15.0: Arrangement (drag & drop, sections, structure builder) done.

- v0.16.0: Interactive Visuals done. All planned upgrades finished (Sample Library cancelled by the user).

- v0.17.0: playable note names, keyboard piano, step entry, audio stability changes.

- v0.18.0: Timeline with seconds and seeking.
- v0.18.3: soft-clip safety stage, CLIP/TIMING readout, polyphony caps.
- v0.18.4: removed the voice cap (it dropped notes).
- v0.18.5: sound audit (levels, DC offset).

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

## v0.20.0 — SHAPE LAB (first toy) added
Beta panel with 3D bouncing balls that play notes of the key and scale. three.js is now a dependency (the bundle is bigger). Next ideas: more shapes, gravity, spectrum-driven surface, writing touches into the piano roll.

## v0.20.1 — stuck notes in SHAPE LAB fixed (fixed-length notes).

## v0.21.0 — SHAPE LAB v2 (chords / arpeggios on the beat, with progression and pattern builders). Next big item: DJ MODE.

## v0.21.1 — SHAPE LAB: own sound + volume per shape, CONVERT TO PATTERN. Next: DJ MODE.

## v0.22.1 — live notes light up in the piano roll
Bug report from the user (keyboard / MIDI playing was not shown). Fixed in one place (`onMidi`), so MIDI and keyboard behave the same. Not verified with a real MIDI device (the MIDI path is the same function as the keyboard).

## v0.22.0 — engine 2 plays all live sound (switchable)
Tracks, keyboard and SHAPE LAB use the AudioWorklet engine; the switch in STATS returns to the old one. Export is unchanged (old engine). Not verified: by ear / real device / long songs on a slow computer. Next: user listens and names sounds to tune; engine 2 for the export; then DJ MODE.

## v0.21.3 — sound engine 2 (AudioWorklet) for SHAPE LAB: measured 6–40× cheaper
Built after the crackle diagnosis and the user's OK. Live SHAPE LAB sounds only; song/export unchanged (so they cannot change). Not verified: listening by ear, real audio device. Known: sound is close but not identical to the old engine (loudness trims are measured; character may differ, e.g. FM index is static); chord-heavy setups should now be playable on slow computers. Next: tell us which sounds to tune; then decide whether the song tracks should use engine 2 too (needs offline rendering for the export) and DJ MODE.

## v0.21.2 — crackle investigation: it is CPU load (not mixer, not clipping). AUDIO BUFFER switch, shorter shape tails, hanging first key fixed.

## v0.22.2 — faster first load
- three.js (SHAPE LAB 3D) is downloaded only when SHAPE LAB is opened; the MP3 encoder (lamejs) only when an MP3 is exported (`import()` in `ShapeLab.tsx` and `exporter.ts`; `encodeAudio` is now async).
- The Fun Sized font is a separate `FunSized.woff2` instead of base64 inside `funsized.css`.
- Canvas loops (Visualizer, Synth Lab scope, Timeline playhead) no longer read layout / computed style every frame (`canvasWatch.ts`: ResizeObserver + theme MutationObserver).
- Result: main JS 1368 → 710 kB (gzip 393 → 211 kB), CSS gzip 89 → 10 kB. Checked: 348 unit tests, build, headless Chromium (play, open SHAPE LAB, MP3 export of one pattern, theme switch, no console errors). Not checked: real phone, Firefox/Safari.
- Note: the build now has more than one JS file plus a font file. A hand-made single-file / file:// build must inline those too.
