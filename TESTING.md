# Testing

## Automatic
```bash
npm test                      # 78 unit tests: pattern, melody (scales, moods, auto melody, velocity), mixer, project validation, WAV encoder
npm run build                 # TypeScript + production build
# optional browser test (needs: npm i -D playwright && npx playwright install chromium)
npm run preview &             # serves http://localhost:4173
node e2e-full.cjs http://localhost:4173     # 37 UI checks, writes WAV/JSON files into ./e2e-out
```

## Manual listening checklist (needs a human)
1. PLAY: kick on 1-2-3-4, snare on 2 and 4, hi-hat on eighths, plus the Happy melody on electric piano.
2. Change BPM 60 → 200 while playing: only the speed changes (hi-hat keeps the same sound).
3. Melody → try every instrument and every mood. Do they sound pleasant? Is the melody level right against the drums?
4. Change **Scale** and **Key**: the tune should change (not just stay the same). Press **✦ AUTO MELODY** several times.
5. Advanced mode: add a chord; drag the **velocity** bars — loud and soft notes should clearly differ.
6. Mixer: Mute/Solo each channel; pan the hi-hat left/right (use headphones); raise Master Reverb and switch Room/Hall/Cathedral.
7. Save, press NEW, Open the file: everything returns. Try opening a broken JSON: you get an error and nothing changes.
8. Export WAV (2 loops), open it in another player (VLC, QuickTime…): length, tempo and reverb tail should match.
9. Stop/Play 10 times: no doubled notes, always starts at step 1. Browser console: no red errors.
