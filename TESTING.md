# Testing

## Automatic
```bash
npm test                      # 122 unit tests: pattern, melody (scales, moods, auto melody, velocity, resizeNote, ambient/arp presets), arpeggiator, song (patterns, playlist, frameAt), mixer + master, project validation (+ v0.5 upgrade), WAV encoder
npm run build                 # TypeScript + production build
# optional browser test (needs: npm i -D playwright && npx playwright install chromium)
npm run preview &             # serves http://localhost:4173
node e2e-full.cjs http://localhost:4173     # 72 UI checks, writes WAV/JSON files into ./e2e-out
python3 analyze-wav.py e2e-out              # (needs numpy) levels per instrument, song structure, ambient/arp checks
```
Tip: run the browser test with a normal-sized window (the script uses 1280×1000). A very tall headless window makes software rendering stall.

## Manual listening checklist (needs a human)
1. PLAY on the MELODY tab: kick on 1-2-3-4, snare on 2 and 4, hi-hat on eighths, plus the Happy melody.
2. Change BPM 60 → 200 while playing: only the speed changes (hi-hat keeps the same sound).
3. **Drag notes**: on an empty row drag sideways – you get one long note. Drag the right end of a note to stretch/shrink it. Click a note to remove it.
4. **AMBIENT** tab: load SHIMMER / ABYSS / DRIFT / SPACE. Does it sit softly under the other tracks?
5. **ARPEGGIO** tab: load MINOR CHORD and try Up / Down / Up-Down / Random, 1/16 vs 1/8, 1–3 octaves, Gate.
6. **Playlist**: create 2–3 patterns, place them on bars, press SONG then PLAY. Watch the highlighted bar and the visualiser. Load the sample “Full Song”.
7. Mixer: Mute/Solo each of the 7 channels; pan the hi-hat; raise Master Reverb; try Master EQ and the Compressor.
8. Save, press NEW, Open the file: everything returns. Open a broken JSON: you get an error and nothing changes. A file saved with v0.5 opens as one pattern.
9. Export WAV in SONG mode and open it in another player: length, tempo, arrangement and reverb tail should match.
10. Stop/Play 10 times: no doubled notes, always starts at bar 1 step 1. Browser console: no red errors.


## v0.14 tests
`midi.test.ts`: file round trips, drums on channel 10, damaged / truncated / random input never throws, grid snapping, live message parsing, quantizing. `e2e-v14.cjs <url>` uses a fake Web MIDI keyboard (a script that injects `navigator.requestMIDIAccess`): connect, record notes and drum hits, export, import, undo, broken file. A real keyboard was NOT tested.

## v0.13 tests
`groove.test.ts` (off = unchanged, repeatable, ghost/fill positions, validation), groove cases in `project.test.ts`, `e2e-v13.cjs` (sliders, preset→custom, two exports differ, save). Two exports of the same groove were compared offline: correlation 0.994 (only the reverb's own noise differs).

## v0.12 tests
`chords.test.ts` (chord names in several keys, range of every voicing in every key, placement styles, suggestions). `e2e-v12.cjs <url>`: builder in the browser.

## v0.11 tests
- `history.test.ts`: undo/redo rules, 100-step limit, autosave with a blocked or full storage.
- `e2e-v11.cjs <url>`: undo/redo buttons and shortcuts, grouped changes, undo of a deleted track, autosave restore / discard / cleared by SAVE.

## v0.10 tests
- `tracks.test.ts`: add/remove/rename, limits, reserved ids, mixer sync.
- `project.test.ts`: version 4 → 5 conversion, renamed/added tracks round trip, bad track lists.
- `e2e-v10.cjs <url>` (Playwright): default tabs, rename, SYNTH piano roll, add/delete, 8-track limit, lab notes track, save, old v4 file, WAV export, phone width.

## v0.9 tests

- `synth.test.ts`: patch validation/clamping/random, library integrity (every sound valid, ids unique, groups), the synth list, synths inside project files (round trip, missing synth, v3 files).
- `demos.test.ts`: every demo song validates, round-trips, is audible, keeps notes in range, uses every pattern.
- `theme.test.ts`: theme cycling and resolution.
- Browser: `node e2e-v09.cjs http://localhost:4173/` (34 checks) and `node e2e-demos.cjs http://localhost:4173/` (exports six demos). Start the preview server in the same shell command (`npx vite preview --port 4173`).
- Level calibration was done by rendering every library sound offline in Chromium (`Tone.Offline`) and measuring RMS/peak.

## v0.15 tests
arrangement.test.ts, sections in project.test.ts (256 unit tests), e2e-v15.cjs (real drag & drop, bin, insert/remove, structure builder, section rename).

## v0.16 tests
vizMath.test.ts (263 unit tests in total), e2e-v16.cjs (all styles draw, choice remembered, ~59 fps headless).

## v0.16.1
Benchmark (bench.cjs, dev only): hat-only render 19.7 s -> 4.4 s for 25.9 s of audio. 263 unit tests, e2e v14 and v16 pass.

## v0.17 tests
keyboardPiano.test.ts (268 unit tests in total), e2e-v17.cjs (note-name click makes sound, step entry in easy and advanced, octave, typing safe, drums pads, toggle). e2e-v14 updated: REC can be armed while stopped.

## v0.17.1
cost.cjs (dev benchmark using CDP Performance.getMetrics). All e2e scripts v10-v17 pass.

## v0.17.2
Benchmarks used while developing: leak2/leak4 (alive native node counts), sched2 (scheduler intervals, 5x CPU throttle), health.cjs. e2e-v09 theme test now selects the button by aria-label.

## v0.18 tests
timeline.test.ts (273 unit tests in total), e2e-v18.cjs (jump while stopped, play from there, jump back while playing, Home, STOP resets, pattern mode).

## v0.18.2 tests
melody.test.ts (notesAtStep, setNoteVelocity), chords.test.ts (velocity shaping), e2e-v182.cjs (3 bars per triad, drag one, Shift, arrows, advanced). 277 unit tests.

## v0.18.3 tests
rig.test.ts (softClip: identity below 0.9, bounded above, odd-symmetric). 278 unit tests in total. Offline render of the Persian Mood demo: peak ≤ 0.89, 0 clipped samples. Not verified: listening by ear on real hardware.

## v0.18.4 tests
No new unit tests; regression checked by comparing offline renders of Persian Mood with and without the cap.

## v0.18.5 tests
Audit script (not shipped): every built-in sound rendered offline on 7 notes; before/after peaks and DC compared. 278 unit tests unchanged. Not verified by ear.

## v0.18.6 — mixer follows the tracks, PAN is a knob
- The mixer always has exactly one channel per track (plus the 4 drum channels). A safety sync now runs whenever the track list changes (add, delete, load, undo), and a row is never hidden because its channel is missing.
- PAN is now a rotary knob (`PanKnob.tsx`): drag up/right = right, down/left = left, arrow keys (Shift = bigger step), Home = centre, End = hard right, double-click = centre. It is a `role="slider"` with the same label as before (`<track> pan`).
- Checked in a real browser (`e2e-v186.cjs`): adding Synth/Arpeggio tracks adds channels, renaming and deleting update the mixer, NEW project resets it. Not checked: by ear that every channel strip changes the sound as expected.

## v0.18.7 — bolder type, prominent section headers
- Section headers (MIXER, DRUMS, PLAYLIST ...) are now 17 px bold Space Grotesk with an accent bar and a soft highlighted background; their hint text on the right stays small. MASTER, mixer group names, channel names, tabs and buttons are bolder too, and the small grey mono labels are bigger and darker. Pure CSS: no behaviour changed.
- Looked at in a desktop screenshot only; the phone layout (<700 px) has its own smaller header rule and was not viewed on a real phone.

## v0.18.8 — Fun Sized heading font
- The logo, the big intro title, every section header (PROJECT, MIXER ...), MASTER and the mixer group names use the **Fun Sized** font (`funsized.css`, embedded as base64 so it also works in the standalone file and offline). It only has capital letters and digits; any other symbol falls back to Space Grotesk. Small text keeps the readable fonts.
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
