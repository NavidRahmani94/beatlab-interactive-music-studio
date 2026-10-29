# BeatLab — Interactive Music Studio (v0.5, test build)

A browser music studio: build a drum beat, write a melody (Easy or Advanced), mix it, save the project and export a real WAV file.
React + TypeScript + Vite + Tone.js. No backend.

## Start
```bash
npm install
npm run dev          # http://localhost:5173  (localhost only; use `npm run dev:lan` to expose on the network)
npm test             # unit tests (Vitest)
npm run build        # type-check + production build
```
Needs Node.js 20.19+ (or 22.12+) and a modern desktop browser. **All files are in one flat folder (no sub-folders).**

## What you can do
| Area | Features |
|---|---|
| **Transport** | Play / Stop (also **Space**), BPM 60–200 changeable while playing |
| **Drums** | 4 voices × 16 steps, 3 drum kits (Classic, 808, Tight), ON/OFF per instrument |
| **Melody – Easy** | Rows contain only notes of the chosen **Key + Scale**, so nothing can sound wrong. **One click = one cell** (note length defaults to 1 step) |
| **Melody – Advanced** | Full piano roll C3–C6 (scrollable), out-of-key rows dimmed, note lengths 1/2/4/8, chords |
| **Instruments** | Soft Synth, Electric Piano, Pluck, Warm Pad, Bell, Lead, Bass (level-matched) |
| **Moods** | Happy, Chill, Dark, Dreamy, Epic, Playful, Sad, Mystery, Groovy — each loads a melody **and** sets scale + instrument |
| **Auto Melody** | ✦ button: new random-but-musical tune for the current key / scale / mood (single-step cells, starts on beat 1, ends on the root) |
| **Key / Scale** | Changing **Key** transposes the tune. Changing **Scale** (Major Pent, Minor Pent, Major, Natural Minor) keeps every note's scale *degree*, so the music really changes (e.g. major → minor) |
| **Velocity** | Velocity lane under the piano roll: drag up/down (or ↑/↓ keys) to set loudness of the notes on each step; "New note velocity" slider; cell brightness shows velocity |
| **Mixer** | Per channel: Mute, Solo, Pan, Volume (−40…+6 dB), Reverb send, Delay send |
| **Master** | Master Volume, **Master Reverb** (amount + size Room/Hall/Cathedral), Delay time (1/16, 1/8, dotted 1/8, 1/4) + feedback, live level meter, limiter |
| **Project** | New / Open / Save (`.beatlab.json`), unsaved-changes warning, 4 sample projects |
| **Export** | WAV: 44.1 kHz, stereo, 16-bit PCM, 1/2/4/8 loops, reverb/delay tail included (offline render, faster than real time) |

## Files
`App.tsx` UI state · `pattern.ts` drum logic · `melody.ts` melody logic (scales, moods, auto-melody, velocity) · `mixer.ts` mixer/master model ·
`instruments.ts` instrument + kit catalogue · `rig.ts` the audio graph (shared by live playback and export) · `engine.ts` live Transport ·
`exporter.ts` + `wav.ts` offline render + WAV encoder · `project.ts` project model + strict validation · `MelodyPanel.tsx`, `MixerPanel.tsx`, `ProjectBar.tsx` UI.
More: `ARCHITECTURE.md`, `TESTING.md`, `DEMO_SCRIPT.md`, `BeatLab_Project_Master_Plan.md`.

## Verified (automatically)
- 78 unit tests pass; `npm run build` succeeds.
- Browser test (`e2e-full.cjs`, 37 checks) in real Chromium: live playback, playhead, all 9 moods, scale/key change, auto melody, velocity lane, chords, mixer, save/open/invalid file, samples, export.
- Exported WAV files analysed: valid 16-bit stereo 44.1 kHz; velocity 100 vs 20 = 5.0× amplitude; 7 instruments all sound different; hard pan puts 100 % of the signal on one side; master reverb adds a tail (Cathedral longer than Room, file length grows); master volume −30 dB measured −29.7 dB.
- Instrument levels balanced to about −15.7 dBFS peak for a single note at velocity 0.8.

## Not verified / known limits
- **Nobody has listened to it yet.** Taste (how good the sounds are) needs your ears: run the manual checklist in `TESTING.md`.
- Only Chromium was tested (not Firefox/Safari).
- One bar (16 steps) per project; fonts load from Google Fonts (system fonts are used offline).
- Instruments are synthesised (no sample files), so they are light-weight but not realistic.
