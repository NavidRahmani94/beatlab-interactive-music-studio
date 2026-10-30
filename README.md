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


## New in v0.14 – MIDI
Open the **🎹 MIDI** panel (under the visualizer).
- **MIDI keyboard** (Chrome / Edge on a computer): CONNECT KEYBOARD, choose the input, and play. The keys play the open tab with its own instrument (DRUMS: pads on General MIDI notes 36 kick, 38 snare, 42 hi-hat, 39 clap; SYNTH LAB: the selected synth).
- **Record:** press PLAY, then ○ REC. Notes you play are written into the open track at the nearest step (note length = how long you hold the key); pad hits are written into the drums. Recording stops when playback stops. Best in PATTERN mode so it loops the pattern you are editing.
- **Export .MID:** the song or the selected pattern as a format-1 MIDI file (drums on channel 10, one MIDI track per BeatLab track).
- **Import .MID:** choose the file, then which track (or the drums) and which 32-step bar to take, or “All bars → new patterns”. Notes are snapped to 16ths and folded into the piano roll range (C3–C6). Optionally use the file's tempo.
Not included: sending notes OUT to a hardware synth, MIDI clock sync, pitch bend / modulation, tempo changes inside a file.

## New in v0.13.1 – animated header
The top of the page has a light animation (`HeroArt.tsx`): mirrored equalizer bars, two drifting waves and rising notes in the theme colours. It follows the tempo, wakes up while the song plays, and stops for people who prefer reduced motion. Only transform/opacity are animated, so it is cheap.

## New in v0.13 – Drum Groove Engine
On the DRUMS tab, the **GROOVE** row has four sliders and presets (Straight, Light swing, MPC swing, Lo-Fi loose, Live drummer):
- **Swing** – every second 16th note is played late (up to 0.4 of a step), drums and notes together.
- **Humanize** – small timing and loudness differences, different for each hit.
- **Ghost notes** – very quiet snare hits next to the backbeat.
- **Variation** – a drum fill in the last bar of every 4 and the odd missing hi-hat.
Everything is calculated from the step number, so a given groove always sounds the same and the WAV / MP3 export matches playback. The genre demos come with a fitting groove. Groove is saved in the project (older files open as “Straight”).

**Bug fixed:** the hi-hat was being triggered with a wrong argument, which made it almost inaudible (and slightly early) in every earlier version. It now plays at its designed pitch and timing, so hats are clearly louder than before; use the HI-HAT fader in the mixer if you want them softer.

## New in v0.12 – Smart Chord Builder
Open **🎹 CHORD BUILDER** on any note track. The seven chords of your key are buttons (I, ii, iii … with their names); click one to put it on the grid. It then moves forward by the chord length and highlights the chords that usually sound good next, with a short reason. Choose length, style (block / strum / arpeggio), register, inversion and 7th chords, or fill the pattern with a ready-made progression (pop, emotional, jazz, epic, dark…). The piano roll switches to ADVANCED automatically when a chord uses notes outside the EASY view.

## New in v0.11 – Undo / Redo and Autosave
- **↶ UNDO / ↷ REDO** (also Ctrl/Cmd+Z, Ctrl+Shift+Z, Ctrl+Y): up to 100 steps for everything in the project, including deleted tracks. Quick changes (a slider drag, several clicks in a row) count as one step. Opening or creating a project starts a fresh history.
- **Autosave:** unsaved work is copied into this browser every 1.5 s. If the page was closed or crashed, a banner offers RESTORE IT or DISCARD. Saving a file clears the copy. It works only in this browser on this device.

## New in v0.10 – your own tracks
- **Synth has its own notes.** The SYNTH tab (and the Synth Lab, via ＋ NOTES TRACK) has a piano roll like the other tracks. Every pattern keeps its own synth notes.
- **Rename any track** (Melody, Ambient, Arpeggio, Synth): type in TRACK NAME at the top of its tab. The mixer follows.
- **Add / delete tracks:** DRUMS stays fixed. ＋ TRACK adds a Melody, Ambient, Arpeggio or Synth track (up to 8). 🗑 DELETE TRACK removes it and its notes from every pattern.
- Each track has its own instrument, notes in every pattern, and mixer channel; arpeggio settings belong to each arpeggio track.
- Older project files (version 1–4) open and are converted automatically.
- Not included yet: recording notes live from the Synth Lab keyboard into the piano roll (notes are placed on the piano roll).

## New in v0.9

- **Theme:** the button at the top right cycles AUTO / DARK / LIGHT (AUTO follows your system). The choice is remembered.
- **Instruments:** the instrument menu of every track now has 12 families (Keys, Organs, Mallets & bells, Plucked strings, Synth leads, Bass, Pads & atmosphere, Strings & winds, Brass, World & Persian, Chip & retro, Textures & FX) and 11 drum kits (Classic, 808, Tight, 909 House/Techno, Trap, Lo-fi, Rock, Electro, Drum & Bass, Industrial, Chip). They are synthesized imitations, not recordings.
- **Synth Lab:** open the SYNTH LAB tab, press NEW SYNTH (or start from any library sound / a random one), shape the sound with the knobs, play it on the on-screen keys or your computer keyboard (A S D F G H J K, black keys W E T Y U), then press MELODY / AMBIENT / ARPEGGIO under "Use this synth on". Your synths are saved inside the project file and are included in WAV / MP3 exports.
- **Demo songs:** the SAMPLE menu has Lo-Fi Chill, House 124, Trap 140, Persian Mood, Synthwave 108 and Chiptune 150 next to the Hip Hop Demo.

## New in v0.15 — Arrangement
- Drag a pattern chip onto a playlist slot; drag a filled slot to move it (Alt/Ctrl = copy); drop it on the bin to clear it. Click-to-paint still works (touch screens do not support drag & drop).
- Insert or remove a slot (the rest shifts).
- Sections (Intro, Verse, Chorus …) are labels with a colour band on the slots; edit names/start/length, or use NAME FROM PATTERNS.
- SONG STRUCTURE: pick Pop / Hip hop / EDM / Short, choose a pattern per role, BUILD ARRANGEMENT. Undo brings the old playlist back.
- Project files keep `sections` (older files open with none).

## New in v0.16 — Interactive Visuals
- Four styles in the VISUALISER panel: BARS, RINGS, PARTICLES, AURORA (the choice is remembered).
- They react to bass, mid and treble energy, overall loudness and a beat pulse detected from the bass. Reduced-motion users get no particle bursts.

## v0.16.1 — performance fix
The hi-hat (Tone.MetalSynth, 12 FM oscillators per hit) used about 60% of the audio load in our benchmark. It is now rendered once per drum kit into a buffer (same sound, correlation 0.99) and only played back. Render time of the demo dropped from 1.45x to about 0.4x of real time on the test machine.

## New in v0.17 — playable notes, keyboard piano, step entry (+ smoother audio)
- Click (or hold) a note name at the left of any piano roll (EASY and ADVANCED) to hear it with that track's sound.
- KEYBOARD PIANO (always visible above the tabs): the computer keyboard plays the open tab — A W S E D F T G Y H U J K = C to C, Z / X change octave. On DRUMS, A S D F are kick, snare, hat, clap. Typing in text boxes never plays.
- REC works with the computer keyboard and with a MIDI keyboard: while the song plays notes go where the playhead is; while stopped it is step entry (notes go to the highlighted step, then the cursor moves; ← → move it).
- Audio: the context now uses a larger buffer and look-ahead (latencyHint playback) so short main-thread hiccups no longer crackle; finished oscillators are freed with a timer instead of requestIdleCallback.

## v0.17.1 — fewer hiccups while playing
- The piano roll redraws only rows that changed, the playhead is moved directly on the DOM, and rows outside the visible part are not painted (content-visibility). In the advanced roll the main-thread busy time during playback dropped from about 13.5 s to 7 s per 15 s in our (software-rendered, headless) benchmark.
- The header animation and the visualiser pause when off screen; the visualiser draws about 30 fps (15 in LITE mode).
- New 🍃 LITE button in the header: stops the decorative animation and halves the visualiser rate (remembered).

## v0.17.2 — audio node leak fixes + timing readout
- Finished notes no longer stay connected to the oscillators frequency/detune signals (the audio library walks all of them on every new connection, so each new note got a little more expensive). Alive oscillators after a minute: about 5x fewer.
- Tone.PolySynth voices are built once and kept (no per-note voice creation, no one-per-second voice disposal): no more voice-building stalls when notes start.
- The visualiser header shows TIMING OK or how many steps started late and the worst delay. If it says OK and you still hear a hiccup, the browser kept up and the cause is outside the page (CPU load from other programs, audio device).

## New in v0.18 — Timeline
- A timeline in the TRANSPORT panel (under the tempo) shows the whole track in seconds: ruler (0:05, 0:10 …), the section names and a coloured block per slot.
- Click or drag to jump anywhere, while stopped (PLAY starts from there) or while playing. Keys: ← → = 1 second, Shift = 1 slot, Home = start. ⏮ goes back to the start.
- In PATTERN mode it shows the one pattern that loops. STOP returns to 0:00. The clock follows the tempo.

## v0.18.1
Less drawing work while playing: the per-slot progress animation in the playlist is gone (the timeline shows the position), and the timeline moves its playhead with a transform at about 30 fps and only rewrites its clock when the text changes. Layout work during playback dropped by about 40% in our benchmark.

## v0.18.2 — velocity per note
- The velocity lane now has one bar per NOTE. The notes of a chord stand side by side on their step (lowest on the left); drag a bar to change only that note. Hold Shift to change the whole step (the old behaviour). Arrow keys adjust a focused bar; the label shows the note and value while dragging.
- A block chord from the chord builder is no longer perfectly even: the lowest note is loudest and each higher note is a little softer (6% steps). Every note can be changed afterwards.
