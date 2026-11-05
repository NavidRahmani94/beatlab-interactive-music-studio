# BeatLab code guide (simple English)

This guide is for anyone who reads the code for the first time. It says what each file does and how the parts work together.

## What is BeatLab?

BeatLab is a music studio that runs in the web browser. There is **no server**: everything happens on the user's computer.
It is written with **React + TypeScript + Vite**. The sound is made with **Tone.js** (a library on top of the browser's Web Audio API).

## Run it

```
npm install        # once
npm run dev        # starts the app at http://localhost:5173
npm test           # runs the unit tests (vitest)
npm run build      # makes the finished app in the "dist" folder
```

## How the parts work together

1. The **user** changes something on the page (for example adds a note in the piano roll).
2. `App.tsx` keeps the whole project in React state. The change goes into this state (the notes, the tempo, the mixer settings, ...).
3. When the music plays, `engine.ts` runs a clock (Tone.Transport). On every 16th-note step it asks `rig.ts` to play what is on that step.
4. `rig.ts` owns all audio objects: the instruments, one channel strip per track (volume, pan, effects), and the master effects.
5. **Export** (`exporter.ts`) uses the **same** `rig.ts` in an offline audio context, so the WAV file sounds exactly like the live music.
6. The **project file** (`project.ts`) is plain JSON. It is checked (validated) when it is opened, and old file versions are upgraded.

## Two kinds of files

- **Pure files** (`melody.ts`, `chords.ts`, `mixer.ts`, `handControl.ts` ...): only functions and data. No audio, no React, no browser. They are easy to test, and most unit tests are for them.
- **Browser files** (`*.tsx`, `rig.ts`, `engine.ts`, `midiInput.ts`, `handTracker.ts` ...): they use React, the audio, the camera or MIDI.

## Rules for the code

- All source files are in **one flat folder** (there are no sub-folders, except `.github/workflows`).
- Every source file **starts with a `// FILE:` line** that says in simple English what the file is for.
- Comments are written in **simple English**: short sentences, no slang. Say *why* the code does something, when it is not obvious.
- A test file has the same name as the file it tests, plus `.test.ts` (some tests cover several files).
- New features get a short note in `PROJECT_STATUS.md` (and `README.md`, `ARCHITECTURE.md`, `TESTING.md`).

## Where is what

### The page and the user interface (React)

| File | What it does |
|---|---|
| `main.tsx` | Starts the app: it puts the App component on the web page. |
| `App.tsx` | The main page. It keeps the whole project in React state (tracks, patterns, playlist, mixer, tempo) and connects every panel to the sound engine. It also handles: play / stop, undo / redo, saving and opening files, MIDI input, the computer-keyboard piano and the hand-gesture controls. |
| `ProjectBar.tsx` | The top bar of the project: name, new / open / save, samples, and export. |
| `PlaylistPanel.tsx` | The pattern list and the playlist (the order of patterns that makes the song). |
| `Timeline.tsx` | The time line of the whole song with the playhead. You can click or drag it to jump to another time. |
| `DrumPanel.tsx` | The drum tab: the step grid for kick, snare, hi-hat and clap, the groove settings and the drum kit choice. |
| `TrackPanel.tsx` | The panel of one melodic track: instrument, key and scale, easy / advanced piano roll, chord builder and arpeggio settings. |
| `PianoRoll.tsx` | The piano roll: a grid where you click or drag to add notes. It also has the velocity lane and the slide lane. |
| `ChordBuilder.tsx` | The chord builder panel (user interface). The chord logic itself is in chords.ts. |
| `SynthPanel.tsx` | The Synth Lab: build your own sound (oscillators, filter, envelopes, effects) and play it with a keyboard. |
| `MixerPanel.tsx` | The mixer: one row per channel (mute, solo, pan, volume, sends, effects, L / R signal meters) and the master settings. |
| `PanKnob.tsx` | A small round knob for the left / right position (pan) of a channel. It works with the mouse, touch and the keyboard. |
| `MidiPanel.tsx` | The MIDI panel: computer-keyboard piano, recording, MIDI keyboard connection, and .mid file import / export. |
| `HandPanel.tsx` | The AIR CONTROL panel: camera switch, camera picture, the instructions and the on / off boxes for each hand gesture. The gesture logic is in handControl.ts and handGestures.ts, the camera and the hand model in handTracker.ts. |
| `ShapeLab.tsx` | The SHAPE LAB panel (beta). A shape with N corners is a chord with N notes. It plays as an arpeggio or as a chord, on the beat, with its own sound. You build the chord progression and the arpeggio pattern, and can convert a shape into a melody track. |
| `voiceWorklet.js` | Sound engine 2: the synthesizer that runs inside an AudioWorklet (plain JS on the audio thread). |
| `workletSynth.ts` | Loads the worklet and wraps it as a `NoteSynth` for the Rig; ENGINE2 switch. |
| `workletTrim.ts` | Measured loudness correction (dB) per sound for engine 2. |
| `legacyPatches.ts` | The 11 basic instruments as synth patches (for engine 2). |
| `shapeMusic.ts` | SHAPE LAB music rules: chords from shapes, chord names, the beat clock, patterns. No graphics and no sound, only plain functions. |
| `shapeScene.ts` | SHAPE LAB drawing (three.js). Draws the turning shapes with the note name on every corner and the chord name above each shape. |
| `Visualizer.tsx` | The live picture of the sound (frequency bars, waveform and a beat bar), drawn on a canvas. |
| `HeroArt.tsx` | A light decorative animation for the top of the page: mirrored equalizer bars, two drifting waves and rising notes. |
| `SystemMonitor.tsx` | A small window that shows how well the page and the audio are running (audio clock, late steps, page speed, memory). |
| `useFollow.ts` | A small React hook for editors that scroll sideways. |
| `useInView.ts` | React hooks that pause decorations when they are not visible, and a saved "lite mode" setting. |

### Sound (Tone.js and the Web Audio API)

| File | What it does |
|---|---|
| `engine.ts` | The live player. It uses one Tone.Transport clock and tells the Rig (rig.ts) which notes to play on every step. App.tsx talks only to this class, never to Tone.js directly. |
| `rig.ts` | All the audio objects: the instruments, the channel strips, the master effects. The same Rig is used for live playback and for the offline export. It also plays single steps (triggerStep) and live notes from a keyboard. |
| `patchSynth.ts` | A synthesizer made from a "patch" (two oscillators, noise, filter, envelopes, effects). It is used by the Synth Lab and by the built-in factory sounds. |
| `toneFix.ts` | A fix for a problem in Tone.js: finished notes were cleaned up too late while music plays, so the CPU use grew slowly. It is applied once, before any audio object is created. |
| `exporter.ts` | Renders the song or one pattern to a WAV or MP3 file, using Tone.Offline and the same Rig as the live player (so the file sounds like the live music). |
| `wav.ts` | Encodes float samples (-1..1) as a standard 16-bit (default) or 24-bit PCM stereo/mono WAV file. |
| `mp3.ts` | Turns audio samples into an MP3 file (uses the lamejs encoder). |

### Music logic (pure functions: no audio, no React, easy to test)

| File | What it does |
|---|---|
| `pattern.ts` | The basic drum pattern: the list of instruments, the number of steps, and small helpers to switch a step on or off. |
| `song.ts` | Patterns and the playlist (which pattern plays when). It also has the maths to find the pattern and step for a given time. |
| `melody.ts` | Notes for melody tracks: the note type, scales and keys, adding / moving / resizing notes, slide notes, and ready-made melodies (presets). Everything here is pure logic (no audio, no React), so it is easy to test. |
| `chords.ts` | Smart Chord Builder: pure music theory. Chords are built from the song's key and scale, placed on the step grid,. |
| `arp.ts` | The arpeggiator: it turns the held notes of an arpeggio track into a run of single notes. Pure logic, no audio. |
| `groove.ts` | Drum Groove Engine: swing, humanize, ghost notes and phrase fills. Pure functions: the same step and tick always give the same. |
| `instruments.ts` | Pure metadata (no audio code) so it can be validated and unit-tested without a browser. |
| `synth.ts` | The sound-design model: a "patch" describes one synthesizer sound. Pure data + validation (no audio code),. |
| `tracks.ts` | The song's tracks. DRUMS is fixed (kick / snare / hi-hat / clap). Every other track is created by the user:. |
| `fx.ts` | Per-channel insert effects: each mixer channel can have up to MAX_FX effects in a row (before pan and the reverb/delay sends). |
| `mixer.ts` | Channels: 4 drum voices + one channel per track (tracks are created by the user). Every channel has its own strip; all strips feed ONE master. |
| `tuning.ts` | Global pitch ("tuning") and tempo styles. |
| `timeline.ts` | Pure maths for the song timeline (seconds <-> steps). One step is a sixteenth note. |
| `vizMath.ts` | Pure helpers for the visualiser: turn an FFT (dB values) into bass / mid / treble energy, loudness and a beat pulse. |

### Project files, saving and history

| File | What it does |
|---|---|
| `project.ts` | The project file: its type, the default and sample projects, checking a loaded file (validation) and upgrading old file versions. |
| `autosave.ts` | Automatic copy of the unsaved project in the browser (localStorage), so a crash or a closed tab does not lose work. |
| `history.ts` | Undo / redo as plain data: a list of earlier states and a list of undone states. Pure, so it is easy to test. |
| `arrangement.ts` | Arranging the song: moving and copying playlist slots, named sections (Intro, Verse, Chorus …) and ready-made song structures. |
| `theme.ts` | Light / dark / follow-the-system theme. The choice is remembered in this browser (storage may be blocked, so every access is guarded). |

### MIDI and hand control

| File | What it does |
|---|---|
| `midiFile.ts` | Standard MIDI File (.mid) writer and reader. Pure data in, bytes out (and back), so it can be tested without a browser. |
| `midiLive.ts` | Playing and recording from a MIDI keyboard: pure helpers (the browser part lives in midiInput.ts). |
| `midiInput.ts` | The browser side of MIDI keyboards (Web MIDI: Chrome, Edge and other Chromium browsers; not Firefox / Safari). |
| `keyboardPiano.ts` | The computer keyboard as a piano: the home row plays the white keys, the row above the black ones (like most DAWs). |
| `handGestures.ts` | Hand gestures from the 21 landmarks of one hand (the MediaPipe hand model). Pure maths, no camera and no browser, so it can be unit-tested. |
| `handControl.ts` | AIR CONTROL: turns hand frames (landmarks of the hands the camera sees) into music actions. Pure logic with an injected clock (the `t` of every frame),. |
| `handTracker.ts` | Camera + hand model. The hand model is MediaPipe's "Hand Landmarker" (Google, runs fully in this browser; the camera picture never leaves the computer). |

### Build

| File | What it does |
|---|---|
| `vite.config.ts` | Build settings for Vite (the tool that runs the dev server and builds the app). |

### Tests

- `*.test.ts` are unit tests (run with `npm test`).
- `e2e-*.cjs` are browser tests (Playwright). Start the dev server first, then run for example `node e2e-v182.cjs http://localhost:5173/`.

## Words used in the code

- **Step**: one 16th note. A pattern has 32 steps (2 bars).
- **Pattern**: the drums and the notes of all tracks for 32 steps. The **playlist** puts patterns one after another to make a song.
- **Track**: one instrument line (melody, ambient, arpeggio, synth ...). The drums are fixed and are not a track.
- **Channel / strip**: the mixer part of a track or of a drum (volume, pan, effects, sends).
- **Rig**: the object that holds all audio nodes (see `rig.ts`).
- **Patch**: the settings of one synthesizer sound (oscillators, filter, envelopes).
- **Slide note**: a note that is not played itself; it bends the pitch of the note that sounds before it.

