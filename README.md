# BeatLab — Interactive Music Studio (v0.6, test build)

A browser music studio with four tracks – **Ambient, Drums, Melody, Arpeggio** – a 7-channel mixer feeding one mastering chain, notes you can stretch to any length, a pattern **playlist** for songs longer than one bar, a live **visualiser**, Save/Open and real WAV export.
React + TypeScript + Vite + Tone.js. No backend.

> New to the code? Read **CODE_GUIDE.md** (simple English: what each file does and how the parts fit together).

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
| **AIR CONTROL (beta)** | Control PLAY / STOP with your hand, through the camera (opt-in; the other gestures are switched off for now) |
| **Melody – Easy / Advanced** | Easy: only notes of the chosen Key + Scale. Advanced: full piano roll C2–C7. Easy has an OCTAVE − / + selector and MOVE ALL NOTES ▼▲ OCT |
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

## Hosting: Vercel and GitHub Pages
The site is published in two places, both built from the `main` branch:
- **Vercel**: https://beatlab-interactive-music-studio.vercel.app (Vercel builds every push to `main` by itself).
- **GitHub Pages**: https://navidrahmani94.github.io/beatlab-interactive-music-studio/ – the workflow `.github/workflows/pages.yml` runs the tests, builds, and publishes the site. One-time setup in the repo: **Settings → Pages → Source: GitHub Actions**.

`vite.config.ts` uses `base: './'`, so the same build works at both addresses. `.github/workflows/` is the only sub-folder: GitHub runs workflows only from there. The app itself stays flat.

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

## v0.18.3 — crackle safety
- A soft clipper now sits after the limiter, so peaks that pile up when many layers play can no longer hard-clip (that is the harsh "khar-khar" sound).
- The visualiser header shows `TIMING OK/…LATE STEPS…` and `LEVEL OK | CLIP ×n`. If the crackle comes back, tell me which one changes.
- (v0.18.4: the voice cap that was added here was removed — Tone DROPS notes over the cap instead of replacing the oldest, which made pads and arps lose notes.)

## v0.18.4 — fix
Removed the 6/8-voice cap from v0.18.3: it silently dropped notes. Voice count is back to Tone's default (32).

## v0.18.5 — sound audit
All 81 built-in sounds were rendered one by one and measured (peak, DC offset, loudness at low/mid/high notes).
- 11 sounds peaked at 0 to -3 dBFS from a single note (e.g. Santur, Glockenspiel, Rhodes, Music box, Upright bass, Arcade arp). With drums and other tracks on top, the limiter had to work constantly, which sounds like crackle. 18 sounds were turned down by 1–8 dB; the loudest single note is now -3.6 dBFS.
- Pulse / PWM sounds (Clavinet, Chip pulse, Arcade arp, Harpsichord, PWM lead, Sitar) had a DC offset that made every note start and end click. It is now filtered out before the envelope.
- Quiet pad-like sounds were NOT turned up (a short test note under-measures slow attacks).

## v0.18.6 — mixer follows the tracks, PAN is a knob
- The mixer always has exactly one channel per track (plus the 4 drum channels). A safety sync now runs whenever the track list changes (add, delete, load, undo), and a row is never hidden because its channel is missing.
- PAN is now a rotary knob (`PanKnob.tsx`): drag up/right = right, down/left = left, arrow keys (Shift = bigger step), Home = centre, End = hard right, double-click = centre. It is a `role="slider"` with the same label as before (`<track> pan`).
- Checked in a real browser (`e2e-v186.cjs`): adding Synth/Arpeggio tracks adds channels, renaming and deleting update the mixer, NEW project resets it. Not checked: by ear that every channel strip changes the sound as expected.

## v0.18.7 — bolder type, prominent section headers
- Section headers (MIXER, DRUMS, PLAYLIST ...) are now 17 px bold Space Grotesk with an accent bar and a soft highlighted background; their hint text on the right stays small. MASTER, mixer group names, channel names, tabs and buttons are bolder too, and the small grey mono labels are bigger and darker. Pure CSS: no behaviour changed.
- Looked at in a desktop screenshot only; the phone layout (<700 px) has its own smaller header rule and was not viewed on a real phone.

## v0.18.8 — Fun Sized heading font
- The logo, the big intro title, every section header (PROJECT, MIXER ...), MASTER and the mixer group names use the **Fun Sized** font (`FunSized.woff2`, loaded by `funsized.css`; since v0.22.2 it is a separate file so it is cached and does not block the CSS — a hand-made single-file build must inline it again). It only has capital letters and digits; any other symbol falls back to Space Grotesk. Small text keeps the readable fonts.
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

## v0.19.0 — AIR CONTROL: control BeatLab with your hands (camera, beta)
- New panel **AIR CONTROL**. The camera is OFF until the person clicks the switch; the instructions (what each hand gesture does, each with a tick box) are shown before and, next to the camera picture, while it is on. Switching off stops the camera and the model.
- How it works: the camera picture is analysed in the browser by MediaPipe **Hand Landmarker** (21 points per hand, `handTracker.ts`); nothing is sent or saved. The library (`@mediapipe/tasks-vision@0.10.21`, from jsDelivr) and the model (~8 MB, from Google storage) are downloaded only when the switch is turned on, so the offline standalone file keeps working without them. First use needs internet; camera needs https:// or localhost.
- Gestures are decided from the landmarks (`handGestures.ts`, pure and unit-tested): open palm, fist, thumb up / down, index up, victory, L-shape, OK sign. `handControl.ts` (pure, injected clock) turns them into actions: ✋ hold = PLAY · ✊ hold = STOP · 👍/👎 tempo ±1 repeating · ☝️ hand height = master volume · 👆👍 L opening = master treble (brightness) · second hand (left) open palm height = reverb · fast flat-hand swipe = next / previous pattern (switches to PATTERN mode) · ✌️ hold 1 s = mute / unmute the open track (drums tab: the four drums) · 👌 OK sign = AIR PIANO (note by left ↔ right from the key + scale, 2 octaves, volume by height, played with the open track's sound).
- Safety: gestures have to be held ~0.5 s, a moving palm restarts the hold, a swipe never starts the music, continuous controls wait 0.25 s; every function can be unticked (saved in the browser).
- Tests: `hand.test.ts` (16, synthetic hands incl. rotation / size), `e2e-v190.cjs` (fake camera + fake tracker: panel, camera on/off, play, tempo, volume, stop, mute, untick, camera released).
- **Not tested here:** the real MediaPipe model with a real hand (this sandbox has no camera and cannot reach the CDN), so thresholds may need tuning from real use. The panel shows the recognised gesture live to help with that.

## v0.19.1 — AIR CONTROL: only PLAY / STOP for now
- First real test by the user: PLAY (open palm) and STOP (fist) worked well, the other gestures (tempo, volume, brightness, reverb, patterns, mute, air piano) did not. So the panel now offers only PLAY / STOP. The code of the others stays in `handControl.ts` (`ALL_HAND_FEATURES` / `EXPERIMENTAL_FEATURES`) and in the unit tests, switched off, so they can be fixed one by one later with real feedback.
- Tests: `hand.test.ts` (17; new: other gestures do nothing by default), `e2e-v190.cjs` updated (thumb up does nothing, play / stop / untick, camera released).

## v0.19.2 — computer-keyboard piano keeps working after touching a slider or list
- Bug: the piano keys (A W S E D F …) were ignored whenever ANY input, slider or drop-down had focus, e.g. after moving the volume / tempo slider or choosing an instrument, until the person clicked somewhere else. Now only real text fields (names, number boxes) block the keys (`isTypingTarget` in `keyboardPiano.ts`, unit-tested). With a drop-down focused, a piano key no longer jumps to a list entry, so it cannot change the instrument by accident.
- Checked in a real browser with real key presses and an audio tap (`e2e-v192.cjs`): keys play on the melody tab, with the instrument list focused (instrument unchanged), with a slider focused, not in a text field, and as drum pads on the DRUMS tab. A MIDI hardware keyboard was also simulated (fake Web MIDI input): notes, chords, drums, note-off, channel 6, active-sensing / pedal / pitch-bend messages all work (`midikbd.cjs`); the CONNECT KEYBOARD button is inside the collapsed 🎹 MIDI panel (click "▸ 🎹 MIDI" first).
- Not tested: a real hardware keyboard.

## v0.19.3 — piano keys work with any keyboard layout (Persian, Arabic, Russian …)
- Bug: the computer-keyboard piano read the typed LETTER (`event.key`). With a Persian (or other non-Latin) layout the A key types "ش", so no key matched and the piano was silent, even with KEYBOARD PIANO ON. Now the PHYSICAL key is used (`event.code`, `pianoKey()` in `keyboardPiano.ts`), the same keys as on a US keyboard (A W S E D F T G Y H U J K, Z / X for the octave, A S D F = drum pads). The letter is used only as a fallback when the browser gives no code.
- Tests: unit tests for `pianoKey`; `e2e-v193.cjs` sends key events as a Persian layout does (key "ش", code "KeyA"): melody and drum pads play, a non-piano key stays silent, the US layout still works.
- Not tested: a real Persian keyboard layout (key events were created with the same key/code pair the browser reports).

## v0.19.4 — code explained in simple English (no behaviour change)
- For the international team: every source file now starts with a `// FILE:` line that says in simple English what the file is for. Long or difficult comments (mainly in `rig.ts`, `App.tsx`, `PianoRoll.tsx`, `project.ts`, `patchSynth.ts`, `SystemMonitor.tsx`) were rewritten with short sentences and common words, and one outdated comment in `song.ts` was corrected.
- New **CODE_GUIDE.md**: what BeatLab is, how to run and test it, how the parts work together, the rules for the code, one line per file, and the words used in the code (step, pattern, track, strip, rig, patch, slide note).
- Only comments and documents were changed. Checked by compiling every file with all comments removed and comparing with the previous version: 76 files, 0 code differences. Unit tests and browser tests were run again.

## v0.20.0 — SHAPE LAB (beta, first toy)
A new panel under AIR CONTROL: **SHAPE LAB**. Click *OPEN SHAPE LAB* to get a 3D box with bouncing balls (three.js). When two balls touch, a note of the key and scale of the open track is played. Height of the touch = pitch, size = volume, the kick drum makes the balls pulse, tempo sets the speed, the key sets the colours. Drag a ball to move it, drag empty space to turn the box, double-click a ball (or DELETE) to remove it, ADD BALL / RESET, SOUND on/off. Max 12 balls. The loop pauses when the tab or the panel is not visible, and LITE mode draws at 30 fps. Not yet: other shapes, gravity, recording touches into the piano roll (ideas for step 2 and 3).

## v0.20.1 — SHAPE LAB: stuck notes fixed
Some SHAPE LAB notes did not stop. Cause: the same note hit again within 200 ms got a second synth voice, but a "release" only frees one voice. Now SHAPE LAB notes are played with a fixed length (start and end planned together, new `liveShot` in rig.ts / engine.ts), so they cannot hang.

## v0.21.0 — SHAPE LAB rebuilt: shapes = chords and arpeggios on the beat
The bouncing balls (v0.20) are gone. Now a shape with 3–6 corners is a chord with 3–6 notes (triad, 7th, 9th, 11th), built from the key and scale of the open track, so it is always in key. Every corner shows its note name, and the chord name (for example Am7) is drawn above the shape. A shape can play as an ARP (one corner after another), as a CHORD (all corners together) or be OFF. Speed 1/4, 1/8 or 1/16. Up to 3 shapes play together (octave −1/0/+1 each).
- **Chord progression builder:** 1–8 bars, one chord (I…VII) per bar, with presets (I–V–vi–IV, ii–V–I…). It is shared by all shapes and repeats.
- **Arpeggio pattern builder:** 8 or 16 steps; click a step to choose which corner plays (or a rest). Presets UP / DOWN / UP-DOWN / SKIP / RANDOM / RHYTHM. In CHORD mode the same grid is the chord rhythm.
- **On the beat:** when the song plays, the shapes follow its 16th-note counter (the chord changes on the bar line). When the song is stopped, PLAY THE SHAPES uses its own beat at the song tempo.
- Click a corner to hear its note. Settings are remembered in the browser.

## v0.21.1 — SHAPE LAB: own sound per shape + CONVERT TO PATTERN
- **Every shape has its own SOUND** (the same instrument library as the tracks) and its own VOLUME (−30…0 dB). The shapes no longer use the open track: they keep playing when you change the tab or the track. They stay live-only: they are not in the song and not in the WAV / MP3 export.
- **⇪ CONVERT TO PATTERN** writes the selected shape (the whole chord progression, as arpeggio or chord) as real notes into a **new melody track** named after the open pattern, for example “Intro · SHAPE 1”. The track gets the sound of the shape. A pattern has 2 bars, so a 4-bar progression fills 2 patterns (missing patterns are added; the playlist is not changed). The new track is opened, and you can edit the notes in the piano roll.
- Fixed while testing: on a fresh page load the sound settings of the shapes could be lost (the panel starts before the audio engine object exists). They are kept in a ref and given to the engine when it is made.

## v0.22.1 — the piano roll shows the notes you play
When you play with the computer keyboard, a MIDI keyboard, or click a note name, the **row of that note lights up** in the piano roll (labels glow, the row is tinted), in both EASY and ADVANCED mode. A chord lights several rows. A note outside the shown range lights the row with the same note name. Lights go out when you release the key.

## v0.22.0 — two sound engines: engine 2 now plays ALL live sound
Engine 2 (AudioWorklet, see v0.21.3) now also plays the **tracks of the song, the keyboard and live MIDI**, not only SHAPE LAB. Slide notes (glide) work in it too. Switch: STATS → SOUND ENGINE → ENGINE 2 / OLD (used after a reload; the choice is remembered). Drums, the mixer and the master chain are the same for both engines.
- **The export (WAV/MP3) still uses the original engine**, so an exported file sounds as before. (Engine 2 for the export needs the note list of the song to be given to the worklet before the offline render; planned.) Because of this, with ENGINE 2 on, the live sound and the export can differ slightly in colour.
- Measured on the demo song: loudness within 4 % of the old engine (RMS 0.0588 vs 0.0565).
- ENGINE 2 needs a web address (npm run dev or a web host); the single HTML file opened directly uses OLD.

## v0.21.3 — sound engine 2 (AudioWorklet) for SHAPE LAB
**Why:** the crackle ("khor khor") was CPU load: every note of the old engine builds about 10 Web Audio nodes. **What:** `voiceWorklet.js` is a synthesizer that runs inside one AudioWorklet node per sound (all voices are calculated in plain code on the audio thread, sample-accurate start times). `workletSynth.ts` connects it to the Rig. It plays the same synth patches (waves, FM, unison, filter 12/24 dB, envelopes, LFO, drive, chorus).
- **Measured (offline, same chords, `wbench.cjs`):** 6-note chord on every 1/16 with a pad: 0.95 → 0.04 of real time (about 26×), supersaw 2.26 → 0.06 (about 39×); all 11 basic and about 70 factory sounds are 6–40× cheaper. The old engine's number includes the master chain, so the true factor of the voices alone is somewhat smaller; it is still far above the 3× we asked for.
- **Used for:** the live SHAPE LAB sounds only. The song, the tracks and the export keep the old engine, so a saved song and its export sound exactly as before. Switch in STATS: SHAPE SOUND ENGINE (ENGINE 2 / OLD), used after a reload. If the browser cannot load an AudioWorklet, the old engine is used automatically. **Important:** Chrome cannot load a worklet when the HTML file is opened directly (file://); the standalone file then uses the old engine (STATS says so). Engine 2 works with `npm run dev` (localhost) or any web host (e.g. GitHub Pages).
- **Loudness:** engine 2 is not bit-identical to the old one. `workletTrim.ts` holds a dB correction per sound (measured), `legacyPatches.ts` has patches for the 11 basic instruments (electric piano, warm pad, ...). Some sounds will differ in character; tell us which and we tune them by ear.

## v0.21.2 — crackle ("khor khor") investigation + fixes
**What was measured** (offline render of dense chords through the same Rig; `costshape.cjs`, `costshape2.cjs`, `clicks.cjs`):
- **Not the mixer / master:** an idle rig costs about 5 % of real time. The peaks of dense chords are only 0.05–0.4, so nothing clips, and there are no clicks (largest jump between two samples 0.017) and no voice stealing.
- **It is CPU load of the voices.** A 4-note pad chord on every 1/8 note costs about 70 % of real time on the test machine; three shapes with chords at 1/8 cost 110 % (more than the machine can do in real time), so the audio thread falls behind and crackles. The main thread (JavaScript) is only 1–5 % of that, so moving the engine to another thread would not help: the sound is already made on the browser's audio thread. The work is the number of oscillators, filters and envelopes that fade out at the same time (long release tails).
- The heaviest sounds are the pads and supersaw-like patches (cinematic, supersaw, ensemblePad, brassSection …: 1.3–2.3 × real time for a 6-note chord on every 16th); the lightest are pluck, bass and chip sounds (0.3–0.6).

**What changed**
- **AUDIO BUFFER switch in STATS:** FAST (about 10 ms, the old setting), SMOOTH (about 23 ms, the new default) and SAFE (80 ms, the most protection). It is used after a reload. STATS also shows the real AUDIO DELAY.
- **Shape sounds have a shorter tail** (at most 0.45 s): about 30 % less CPU for chords (0.67 → 0.42, 1.11 → 0.79 in the test). Only the live shape sounds; the tracks of the song are unchanged.
- **Hanging note fixed (found while testing):** a very quick first tap on the computer-keyboard piano (before the audio engine was ready) made the note hang forever, because the key-up had nothing to stop. Now a key that was released early plays a short note.
- **Honest limit:** very dense setups (several shapes with 5–6 note chords at 1/16 on a pad) are still too heavy for a slow computer. Use fewer corners, a slower speed, a lighter sound (pluck, bass, chip) or the SAFE buffer. The real cure would be a new, lighter synth engine written for the browser's AudioWorklet (a big job, not done yet).
