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
