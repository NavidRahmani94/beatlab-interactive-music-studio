# BeatLab — Phase 0 + Phase 1 (v0.1.1)

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
Piano Roll, channel mixer/effects, JSON save/load, WAV export, UI automation and audio-render verification. The phase is **not formally accepted** until browser listening, repeat Play/Stop and BPM tests pass on the user's machine.

## Manual acceptance checklist
1. Run `npm install`, `npm test`, `npm run build`, `npm run dev`.
2. Click PLAY: kick plays on beats 1–4; snare on beats 2 and 4; hi-hat on eighth notes.
3. Change BPM from 100 to 140 during playback; confirm tempo changes without duplicate hits.
4. Toggle steps while playing; changes should be audible.
5. Stop and start 10 times; check no doubled notes and playback restarts at step 1.
6. Enable clap steps and verify clap sound.
7. Open browser developer console; check no critical errors.

## Architecture
All source lives in `src/`. `App.tsx` owns UI state, `pattern.ts` contains pure pattern logic, and `engine.ts` owns Tone.js instruments, clock and scheduling. The engine reads the current pattern without recreating transport events after each edit.

## Known limitations
Drum sounds are synthesized rather than loaded samples; exact sound character may vary by browser. Phase 1 has no audio export. The phase 2 grid is an early preview, not a fully accepted phase.

## Changelog v0.1.1
- Fixed `npm run build` (TS2353): `MetalSynth.frequency` is now set after construction.
- Moved sources to `src/`; `tsconfig` includes `src`.
- Added `package-lock.json`, `.gitignore`, `engines`; moved vite/plugin-react to devDependencies.
- `dev` no longer binds to 0.0.0.0 (use `dev:lan`).
- UI phase labels corrected; 4 extra unit tests (8 total).

## Verification status
- `npm test` (8 pass) and `npm run build`: verified.
- Headless Chromium smoke test: Play starts, playhead moves, BPM change applies, 10x Stop/Play leaves no stuck state, no app errors.
- **Not verified:** actual audio character/timing by ear, Firefox. Do the manual checklist above.
- Fonts load from Google Fonts (needs internet; falls back to system fonts offline).
