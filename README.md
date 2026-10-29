# BeatLab — Phases 0–3 (v0.2.0, audio unverified)

A working browser drum-engine prototype using React, TypeScript, Vite and Tone.js.

## Requirements
- Node.js 20.19+ or 22.12+
- npm and a modern desktop browser

## Start
```bash
npm install
npm run dev          # localhost only
npm run dev:lan      # exposed on the local network
```
Open the URL printed by Vite (typically http://localhost:5173).

## Verify
```bash
npm test
npm run build
```

## How to use
- Click **PLAY** to unlock browser audio and start the synchronized 16-step loop.
- Adjust BPM between 60 and 200 while playing.
- Click individual drum steps to enable/disable sounds in real time.
- Click **STOP** to reset the playhead; **CLEAR ALL** to silence the pattern.

## Included
- Phase 0 scaffold, React/TS/Vite configuration
- Phase 1: four synthesized drum voices (kick, snare, closed hi-hat, clap), one Tone.Transport clock, BPM, Play/Stop, resource cleanup
- Early preview of Phase 2: interactive 4×16 drum grid
- Unit tests for pure pattern logic

## Not implemented yet
Chord progressions, channel mixer/effects, JSON save/load, WAV export, UI automation and audio-render verification. The phase is **not formally accepted** until browser listening, repeat Play/Stop and BPM tests pass on the user's machine.

## Manual acceptance checklist
1. Run `npm install`, `npm test`, `npm run build`, `npm run dev`.
2. Click PLAY: kick plays on beats 1–4; snare on beats 2 and 4; hi-hat on eighth notes.
3. Change BPM from 100 to 140 during playback; confirm tempo changes without duplicate hits.
4. Toggle steps while playing; changes should be audible.
5. Stop and start 10 times; check no doubled notes and playback restarts at step 1.
6. Enable clap steps and verify clap sound.
7. Open browser developer console; check no critical errors.

## Architecture
`App.tsx` owns UI state, `pattern.ts` contains pure pattern logic, and `engine.ts` owns Tone.js instruments, clock and scheduling. The engine reads the current pattern without recreating transport events after each edit.

## Known limitations
Drum sounds are synthesized rather than loaded samples; exact sound character may vary by browser. Phase 1 has no audio export. The phase 2 grid is an early preview, not a fully accepted phase.

## Changelog v0.1.1
- Fixed `npm run build` (TS2353): `MetalSynth.frequency` is now set after construction.
- Flat layout kept (all files in project root, no subfolders).
- Added `package-lock.json`, `.gitignore`, `engines`; moved vite/plugin-react to devDependencies.
- `dev` no longer binds to 0.0.0.0 (use `dev:lan`).
- UI phase labels corrected; 4 extra unit tests (8 total).

## Changelog v0.2.0 — Phase 3: Melody (Easy + Advanced)
- New `melody.ts` (pure logic), `MelodyPanel.tsx` (UI), `melody.test.ts` (16 tests; 24 total).
- **One data model, two views.** Both modes edit the same note list `{id, pitch, step, lengthSteps, velocity}`.
- **Easy mode:** rows are only the notes of the chosen Key + Scale (so no wrong notes); note length SHORT/MEDIUM/LONG (1/2/4 steps); presets HAPPY / CHILL / DARK.
- **Advanced mode:** full chromatic piano roll C3–C6 (scrollable), out-of-key rows dimmed, lengths 1/2/4/8, chords allowed.
- Changing **Key** transposes the melody; changing **Scale** snaps notes to the nearest note of the new scale.
- Click an empty cell to add a note, click an existing note to remove it. Melody has its own ON/OFF.
- Melody (PolySynth, triangle) runs on the same Transport as the drums; stop releases all notes.
- Deviation from the master plan: range is C3–C6 instead of C3–C5 so every key fits the Easy view.

## Changelog v0.1.3
- Per-instrument ON/OFF button in the drum grid (pattern is kept; the voice is silenced).
- Fixed timbre changing with tempo: drum notes now use fixed durations in seconds instead of musical values (e.g. '32n'), which cut the envelope differently at each BPM. Measured hi-hat spectral centroid: 4433/5040/5274 Hz at 60/120/200 BPM before, constant 6030 Hz after. Hi-hat volume raised to compensate.

## Verification status
- `npm test` (8 pass) and `npm run build`: verified.
- Headless Chromium smoke test: Play starts, playhead moves, BPM change applies, 10x Stop/Play leaves no stuck state, no app errors.
- **Not verified:** actual audio character/timing by ear, Firefox. Do the manual checklist above.
- Phase 3 checks done: melody synth pitches measured offline (C4/E4/A4/C5 = 262/330/440/523 Hz), headless-browser test of Easy/Advanced editing, ON/OFF, key/preset change, no page errors.
- Fonts load from Google Fonts (needs internet; falls back to system fonts offline).
