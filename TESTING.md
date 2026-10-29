# Testing

## Automatic
```bash
npm test                      # 121 unit tests: pattern, melody (scales, moods, auto melody, velocity, resizeNote, ambient/arp presets), arpeggiator, song (patterns, playlist, frameAt), mixer + master, project validation (+ v0.5 upgrade), WAV encoder
npm run build                 # TypeScript + production build
# optional browser test (needs: npm i -D playwright && npx playwright install chromium)
npm run preview &             # serves http://localhost:4173
node e2e-full.cjs http://localhost:4173     # 72 UI checks, writes WAV/JSON files into ./e2e-out
python3 analyze-wav.py e2e-out              # (needs numpy) levels per instrument, song structure, ambient/arp checks
```
Tip: run the browser test with a normal-sized window (the script uses 1280×1000). A very tall headless window makes software rendering stall.

## Manual listening checklist (needs a human)
1. PLAY on the MELODY tab: kick on 1-2-3-4, snare on 2 and 4, hi-hat on eighths, plus the Happy melody.
2. Change BPM 60 → 200 while playing: only the speed changes (hi-hat keeps the same sound).
3. **Drag notes**: on an empty row drag sideways – you get one long note. Drag the right end of a note to stretch/shrink it. Click a note to remove it.
4. **AMBIENT** tab: load SHIMMER / ABYSS / DRIFT / SPACE. Does it sit softly under the other tracks?
5. **ARPEGGIO** tab: load MINOR CHORD and try Up / Down / Up-Down / Random, 1/16 vs 1/8, 1–3 octaves, Gate.
6. **Playlist**: create 2–3 patterns, place them on bars, press SONG then PLAY. Watch the highlighted bar and the visualiser. Load the sample “Full Song”.
7. Mixer: Mute/Solo each of the 7 channels; pan the hi-hat; raise Master Reverb; try Master EQ and the Compressor.
8. Save, press NEW, Open the file: everything returns. Open a broken JSON: you get an error and nothing changes. A file saved with v0.5 opens as one pattern.
9. Export WAV in SONG mode and open it in another player: length, tempo, arrangement and reverb tail should match.
10. Stop/Play 10 times: no doubled notes, always starts at bar 1 step 1. Browser console: no red errors.
