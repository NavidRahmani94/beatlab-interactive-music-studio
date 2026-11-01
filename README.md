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
