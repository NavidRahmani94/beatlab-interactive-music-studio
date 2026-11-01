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
