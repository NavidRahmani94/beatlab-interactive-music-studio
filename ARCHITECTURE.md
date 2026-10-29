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
