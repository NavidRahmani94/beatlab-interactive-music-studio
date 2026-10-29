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
