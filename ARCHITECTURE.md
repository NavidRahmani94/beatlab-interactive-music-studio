# Architecture (v0.6)

```
React UI  ProjectBar · Transport · Visualizer · Tabs [AMBIENT | DRUMS | MELODY | ARPEGGIO] · PlaylistPanel · MixerPanel
   │  state: patterns[], playlist[], current pattern, play mode, instruments per track, arp settings, kit, key/scale, channels, master, bpm
   ▼
project.ts ── one BeatLabProject (schemaVersion 2). validateProject on Open (version-1 files are upgraded to one pattern), serialize on Save.
   │
   ├── song.ts   PatternData {name, drums, melody, ambient, arp} · Playlist = one slot per bar (pattern index | null) · frameAt(tick) -> {bar, step, pattern}
   ├── arp.ts    arpAt(heldNotes, step, settings, tick) – pure, deterministic arpeggiator
   │
   ├── engine.ts (live)  Transport.scheduleRepeat('16n'); own tick counter -> frameAt -> Rig.triggerStep(...) + frame callback (playhead)
   └── exporter.ts (WAV) Tone.Offline + the same scheduling and the same frameAt -> Rig.triggerStep(...)
                                                    │
 4 drum voices ─┐                                  rig.ts  (one class, used by both)
 melody synth ──┤► 7 channel strips (volume, pan, mute/solo) ─┬─► MASTER IN ─► EQ3 ─► compressor ─► master reverb ─► master volume ─► limiter ─► out (+ meter, spectrum, waveform)
 ambient synth ─┤                                             ├─► reverb send bus ─┘
 arp synth ─────┘                                             └─► delay send bus (tempo-synced) ─┘
```
* **One Rig for live and export.** The same class builds the whole sound path, so the WAV sounds like what you hear.
* **Patterns and playlist.** A pattern is one bar (16 steps) of all four tracks. The playlist (1–32 bars) places patterns on bars; PATTERN mode loops the selected pattern, SONG mode walks the playlist and loops. The same pure `frameAt` function decides what plays in live mode and in the export, so they cannot disagree.
* **Notes of any length.** Melody/ambient/arp share one note model `{id, pitch, step, lengthSteps, velocity}`. The piano roll turns pointer drags into `toggleNote` (create) and `resizeNote` (stretch / shrink; clipped at the bar end and at the next note of the same pitch).
* **Arpeggio.** The arp track stores held notes (a chord drawn as long notes). `arpAt` turns whatever is held on a step into one note per 1/16 or 1/8 (Up, Down, Up-Down, Random; 1–3 octaves; gate).
* **Four tracks, one key.** Key and Scale are shared; changing them transposes / remaps every track of every pattern.
* **Timing.** Notes are scheduled on Tone's audio clock (`Transport`), never with `setInterval`. Drum hits use fixed durations in seconds so their timbre never depends on BPM.
* **Validation.** `validateProject` checks every field (ranges, 16 steps, notes inside the bar, playlist indices, known instrument/kit/reverb/delay/arp ids). Invalid files are rejected with a message and the current project is kept. Older files open with defaults.
* **Export.** Offline render (44.1 kHz stereo). SONG mode renders the playlist up to its last used bar × the chosen number of repeats; PATTERN mode renders the selected pattern for N bars. The tail depends on the master reverb size; `wav.ts` writes 16-bit PCM with clipping protection.
* **Visualiser.** Two `Tone.Analyser` nodes after the limiter (FFT + waveform) feed a canvas drawn with `requestAnimationFrame` (no React re-renders); the playlist highlights the playing bar.


## v0.14 additions
`midiFile.ts` (pure): .mid writer and strict reader (running status, velocity-0 note-offs, SMPTE rejected, size and note limits), notes → grid and GM drums → pattern. `midiLive.ts` (pure): message parsing, drum pad map, `quantizePosition`, `heldSteps`. `midiInput.ts`: Web MIDI wrapper (browser only). The Rig has `liveDown/liveUp/liveDrum`, which use the same voices as the song and start slightly later while the transport runs (Tone refuses events in the past). `MidiPanel.tsx` is the UI; App owns the recording logic.

## v0.13 additions
`groove.ts` (pure): `drumHits(drums, step, tick, groove)` returns the hits of a step (own hits + ghost notes + fills, with delay and velocity), `swingDelay`, `stepDrift`, and a hash-based `rand(tick, salt)`. The Rig calls them in `triggerStep`, so live play and export are identical. `groove` is a field of the project (optional in the file, default straight).

## v0.12 additions
`chords.ts` (pure): diatonic chords from key + scale (pentatonic uses the parent 7-note scale), voicing/inversion kept inside C3–C6, block/strum/arp placement, merge into a track, next-chord suggestions, progressions. `ChordBuilder.tsx` is the UI inside `TrackPanel`.

## v0.11 additions
- `history.ts` (pure): `commit / undo / redo` on `{past, future}` lists of whole-project snapshots (max 100). `autosave.ts`: localStorage wrapper that never throws.
- App commits a snapshot 500 ms after the last change (`flushHistory`), restores with `setAll`. Autosave waits until the restore question is answered.

## v0.10 additions – dynamic tracks (schema 5)
- `tracks.ts` (pure): `TrackDef {id,name,kind,instrument,arp}`, kinds melody|ambient|arp|synth, add/remove/rename helpers, max 8 tracks, reserved ids (`drums`, `lab`, drum names, `__proto__`…).
- `PatternData.notes: Record<trackId, MelodyNote[]>` (empty tracks have no entry, see `compactNotes`). `channels` has the 4 drum channels plus one per track (`syncChannels`).
- `Rig.setTracks(defs)` builds one voice per track; arpeggio settings come from each arp track. The same Rig is used for live play and offline export.
- `project.ts#toV5` converts schema 1–4 files before validation.
- App: `view` is `'drums' | trackId | 'lab'`; `SynthPanel` embeds the piano roll of the Synth track bound to the selected synth.

## v0.9 additions

- `synth.ts` (pure): `SynthPatch` model, limits, `validatePatch`/`clampPatch`/`randomPatch`, the library `FACTORY_SOUNDS` (patch data per instrument) and the helpers for the project's `synths` list (`synth:<id>` references).
- `patchSynth.ts`: `PatchSynth` = polyphonic voice pool (osc1 + osc2 + noise -> filter -> amp envelope -> tremolo -> drive -> chorus -> volume). Sources only run while a note sounds. It captures the audio context at construction because voices are created lazily during playback (in the offline export the global context has already changed by then).
- `rig.ts`: `setSynths()`, instrument resolution (built-in PolySynth sounds, library patch, or the user's patch), a signature per voice so a track is rebuilt when its patch changes, and an extra audition voice for the Synth Lab keyboard. `engine.ts` forwards `setSynths` and `auditionDown/Up/Stop`; `exporter.ts` calls `rig.setSynths(project.synths)` before building the tracks.
- `project.ts`: schema 4 (`synths`), tracks may reference `synth:<id>`, version-3 files still open; seven demo songs.
- `theme.ts` + CSS variables in `main.css` (dark default, `[data-theme=light]` overrides); a tiny script in `index.html` sets the theme before the first paint.

## v0.15 additions
`arrangement.ts` is pure: slot operations (move/copy/clear/insert/remove), section helpers, `autoSections`, `STRUCTURES`, `guessRoles`, `buildStructure`. Sections are labels only and never affect audio. `PlaylistPanel` uses HTML5 drag & drop.

## v0.16 additions
`vizMath.ts` is pure (band energies from the FFT, loudness, `BeatPulse` onset detector). `Visualizer.tsx` draws all styles on one canvas with requestAnimationFrame; no React re-renders per frame.

## v0.16.1
`Rig.buildHat` renders one hat hit per kit in a private OfflineContext (synchronously switching the global Tone context, like patchSynth). Falls back to the MetalSynth until the buffer exists.

## v0.17 additions
`keyboardPiano.ts` (pure key mapping, octave, step cursor). App: keyboard listeners feed the same `onMidi` path as a real MIDI keyboard; `previewNote` for the note names; `stepCursor` for step entry. `toneFix.ts`: Tone context with latencyHint playback + lookAhead 0.15, and a timer-based dispose of finished one-shot sources.

## v0.17.1
`PianoRoll` Row is memoised on a per-row signature; playhead class set imperatively; `useInView` pauses HeroArt/Visualizer when off screen; LITE flag in localStorage `beatlab.lite.v1`.

## v0.17.2
`toneFix.ts` also records the owning Tone.Oscillator of each one-shot node and cuts the frequency/detune link when it ends. `pinVoices` in rig.ts. `Engine.getHealth()` counts steps whose callback ran after their own start time (raw context clock).

## v0.18 additions
`timeline.ts` (pure seconds/steps maths), `Timeline.tsx` (playhead moved on the DOM by requestAnimationFrame), `engine.seek(step)` (sets the tick counter; `startTick` for PLAY). Startup project now has sections too.

## v0.18.3 additions
`rig.ts`: master chain ends limiter → `safety` (WaveShaper with `softClip`, 2x oversampling) → destination; meters tap `safety`. `getHealth` (engine) and the CLIP counter (Visualizer) are diagnostics only.

## v0.18.4
Removed `maxPolyphony` caps from `makeVoice` (Tone drops new notes over the cap, it does not steal a voice).

## v0.18.5
`patchSynth.ts`: voices with a pulse/PWM oscillator get a 20 Hz high-pass (`dcb`) between the filter and the amp envelope. `synth.ts`: `volumeDb` of 18 factory sounds lowered (measured by rendering each sound offline).

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
