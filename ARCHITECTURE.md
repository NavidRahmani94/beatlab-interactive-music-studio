# Architecture

```
React UI (ProjectBar · Transport · Drum grid · MelodyPanel · MixerPanel)
        │  state: pattern, melody notes, channels, master, instrument, kit, key/scale, bpm
        ▼
project.ts  ── one BeatLabProject object (validated on Open, serialised on Save)
        │
        ├── engine.ts  (live)  Tone.Transport.scheduleRepeat('16n') ─┐
        │                                                            ├─►  rig.ts  Rig.triggerStep(step, time, …)
        └── exporter.ts (WAV)  Tone.Offline + the same scheduling ───┘
                                                                          │
   instruments ─► channel strip (volume, pan, mute/solo) ─┬─► master in ─► master reverb ─► master volume ─► limiter ─► out
                                                          ├─► reverb send bus ─┘
                                                          └─► delay send bus (tempo-synced) ─┘
```
* **One Rig for live and export.** The same class builds the whole sound path, so the WAV sounds like what you hear.
* **Timing.** Notes are scheduled on Tone's audio clock (`Transport`), never with `setInterval`. Drum hits use fixed durations in seconds so their timbre never depends on BPM.
* **Melody model.** One list of `{id, pitch, step, lengthSteps, velocity}` shared by Easy and Advanced views.
* **Validation.** `validateProject` checks every field (ranges, 16 steps, notes inside the bar, known instrument/kit/reverb/delay ids). Invalid files are rejected with a message and the current project is kept. Older files without the newer fields still open (defaults are filled in).
* **Export.** Offline render (44.1 kHz, stereo), tail length depends on the master reverb size, then `wav.ts` writes 16-bit PCM with clipping protection.
