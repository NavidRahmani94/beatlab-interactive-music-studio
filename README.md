# BeatLab — Interactive Music Studio (v0.6, test build)

A browser music studio with four tracks – **Ambient, Drums, Melody, Arpeggio** – a 7-channel mixer feeding one mastering chain, notes you can stretch to any length, a pattern **playlist** for songs longer than one bar, a live **visualiser**, Save/Open and real WAV export.
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
| **Four tabs** | **AMBIENT** (long pads/drones), **DRUMS** (unchanged: 4 voices × 32 steps, 3 kits, ON/OFF each), **MELODY**, **ARPEGGIO** – each has its own mixer channel |
| **Notes of any length** | Click = new note. **Drag sideways** on empty cells = a note of any length. Drag the end of a note to stretch/shrink it. Click a note to remove it. Connected cells show the length |
| **Melody – Easy / Advanced** | Easy: only notes of the chosen Key + Scale. Advanced: full piano roll C3–C6 |
| **Instruments (11)** | Soft Synth, Electric Piano, Pluck, Warm Pad, Bell, Lead, Bass, **Strings, Air Pad, Glass Pad, Drone** – any instrument on any melodic track |
| **Moods / presets** | Melody: 9 moods + ✦ Auto Melody. Ambient: Drift, Abyss, Shimmer, Space. Arpeggio: Minor chord, Major chord, Two chords, Bell arp |
| **Arpeggiator** | Draw a chord as long notes; it is played note by note: Up / Down / Up-Down / Random, 1/16 or 1/8, 1–3 octaves, gate |
| **Key / Scale** | Shared by all tracks and patterns: Key transposes everything, Scale keeps every note's degree so the music really changes |
| **Velocity** | Velocity lane under every piano roll |
| **Patterns & Playlist** | Up to 16 patterns (new / duplicate / rename / delete) placed on a playlist of 1–32 bars; **PATTERN** mode loops one pattern, **SONG** mode plays the whole playlist |
| **Visualiser** | Live spectrum + waveform + beat bar; the playlist highlights the playing bar |
| **Mixer** | 7 channels (Kick, Snare, Hi-hat, Clap, Melody, Ambient, Arpeggio): Mute, Solo, Pan, Volume, Reverb send, Delay send |
| **Master** | Volume, **3-band EQ**, **Compressor (glue)**, Reverb (amount + Room/Hall/Cathedral), Delay time + feedback, level meter, limiter |
| **Project** | New / Open / Save (`.beatlab.json`, version 2; v0.5 files still open), unsaved-changes warning, 5 sample projects (incl. “Full Song”) |
| **Export** | WAV 44.1 kHz stereo 16-bit: the whole song (SONG mode) or the selected pattern, 1/2/4/8 repeats, reverb tail included |

## Files
`App.tsx` UI state · `pattern.ts` drum logic · `melody.ts` note logic (scales, moods, auto-melody, velocity, resize) · `arp.ts` arpeggiator · `song.ts` patterns + playlist · `mixer.ts` mixer/master model ·
`instruments.ts` instrument/kit/track catalogue · `rig.ts` the audio graph (shared by live playback and export) · `engine.ts` live Transport ·
`exporter.ts` + `wav.ts` offline render + WAV encoder · `project.ts` project model + strict validation · UI: `DrumPanel.tsx`, `TrackPanel.tsx`, `PianoRoll.tsx`, `PlaylistPanel.tsx`, `Visualizer.tsx`, `MixerPanel.tsx`, `ProjectBar.tsx`.
More: `ARCHITECTURE.md`, `TESTING.md`, `DEMO_SCRIPT.md`, `BeatLab_Project_Master_Plan.md`.

## Verified (automatically)
- 122 unit tests pass; `npm run build` succeeds.
- Browser test (`e2e-full.cjs`, 72 checks) in real Chromium: four tabs, drums unchanged, click/drag-create/stretch/shrink/remove notes, keyboard entry, ambient + arp presets and controls, patterns (new/rename/duplicate/delete), playlist painting, SONG-mode playhead through 8 bars, visualiser drawing, 7-channel mixer, master EQ/compressor, save/open (incl. v0.5 file and a bad playlist), 5 samples, WAV exports.
- Exported WAV analysed: “Full Song” (8 bars, 96 BPM) – bars 1-2 (no drums) ≈ −29 dB RMS, bars 3-6 (groove) ≈ −24.6 dB, bars 7-8 (breakdown) ≈ −30.8 dB, so the arrangement is really in the file; the solo-ambient render sustains across bars; the arp render shows 15 of the 16 expected note onsets in a bar by a simple detector (the arpeggiator logic itself is unit-tested).
- Instrument levels measured and matched (8-step note at velocity 1, RMS between about −25 and −32 dBFS; Pluck is short so reads lower).

## Not verified / known limits
- **Nobody has listened to it yet.** Taste (how good the sounds and presets are) needs your ears: run the manual checklist in `TESTING.md`.
- Only Chromium was tested (not Firefox/Safari). The phone layout (≤700 px wide) was checked in Chromium phone emulation at 390 and 360 px (no sideways scrolling, taps work) but not on a real phone. On iPhones the silent switch can mute web audio.
- A pattern is one bar (32 steps); longer songs use the playlist. Ambient notes that continue over several bars are re-triggered at each bar (a soft swell every bar).
- Fonts load from Google Fonts (system fonts are used offline). Instruments are synthesised (no sample files).

## GitHub Pages
Push to a repository's `main` branch, then in the repo go to **Settings → Pages → Source: GitHub Actions**. The workflow in `.github/workflows/pages.yml` runs the tests, builds, and publishes the site at `https://<user>.github.io/<repo>/`. (If your tooling cannot keep the `.github` folder, delete it; the app itself stays flat.)
