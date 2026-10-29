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
