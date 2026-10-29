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
