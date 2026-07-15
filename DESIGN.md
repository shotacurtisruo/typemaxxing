# 🔊 Thock — Design Brief

**A chill-first 3D ASMR typing-climber.** MonkeyType rules over a candy world: you type a
passage MonkeyType-style (wrong keys type through in red; backspace to fix), while a 2D pixel
cat walks/runs across continuous word-platforms on an endless spiral tower — legs animate by
your live WPM, space jumps to the next platform, and 3 fresh reds make the cat slip and fall
(fallen words are retyped). Every correct key fires the layered pentatonic binaural material
sound of the platform you're on.

## Locked design decisions
- **Core vibe:** chill-first; scores optional (no hard fail)
- **Coupling:** caret-synced — the pixel cat walks the current word-platform to your caret; space = jump
- **World:** endless ascending **spiral** of continuous word-platforms (one word = one platform), material **zones/biomes**
- **Character:** customizable 2D **pixel cat** (side-profile; idle/walk/run/air frames; fur + scarf colors)
- **Framing:** endless climb with passage checkpoints
- **Miss:** MonkeyType — wrong key types through **red**, backspace deletes; 3 fresh reds = slip & fall back 1-2 words (retype them). `?clumsy` = fall on 1 red (debug)

### Audio (the soul)
- Two layers per keystroke: mechanical **switch thock** + **material squish**
- **Pentatonic-tuned** so flowing text plays a rising melody (never dissonant)
- **Full binaural 3D** (Web Audio HRTF panner) — headphones-first
- **Flow meter**: clean streaks → juicier reverb/warmth + faster climb; breaking it snaps back dry
- Subtle, switchable **ambience bed**; **summit payoffs** at checkpoints
- Assets = **hybrid**: procedural synthesis now (v1), swap in organic recorded samples later

### Art
- **Hyper-tactile realism** — glossy, jiggly, wet gloss highlights from colored rim lights

### Progression & meta (post-v1)
- **Milestone + light-currency unlocks, no gacha**
- Collectibles **led by keyboard-authentic** items (real switches: Browns/Blues/holy pandas;
  keycap sets) + whimsical extras (blob skins, fantasy materials, ambience beds)
- **Local-first**, then Firebase for cloud saves, leaderboards, and a **daily passage** (Wordle-style)

## v1 MVP — "core magic only" (SHIPPED)
North star = the **audio feel**.
- Split-screen: 3D spiral tower (top) + MonkeyType-style typing bar (bottom)
- Type-the-keycap hop; camera climbs & orbits with the blob
- One gel blob (no customization UI yet); 4 material zones (jelly/foam/gel/bubble)
- Full pentatonic + binaural audio engine (synthesized), flow meter, dud on miss
- WPM / accuracy / height HUD; standard common-words passages; endless via `baseOffset`

## Deferred (post-v1)
Unlock system / currency / shop · full switch & skin & zone catalog · Firebase cloud + leaderboards +
daily passage · customization UI · big summit spectacle · settings menus · real sample library.

## Tech
Vite + React + TypeScript · **React Three Fiber** (`@react-three/fiber`, `drei`) for 3D ·
**Web Audio API** (custom synthesis engine) · **Zustand** for game state.

## Code map
- `src/game/config.ts` — spiral geometry, materials/zones, pentatonic scale, pan helper
- `src/game/store.ts` — Zustand game state + `press()` loop + WPM/acc/height selectors
- `src/game/passage.ts` — common-words generator
- `src/audio/AudioEngine.ts` — the synthesis engine (thock, squishes, dud, reverb, ambience, binaural)
- `src/three/Scene.tsx` — Canvas, lights, climbing camera
- `src/three/Tower.tsx` / `Keycap.tsx` / `Blob.tsx` — the 3D world
- `src/ui/TypingBar.tsx` / `Hud.tsx` — typing display + stats/flow/mute
- `src/App.tsx` — layout + global keydown → store + audio

## Run
```bash
npm install
npm run dev   # http://localhost:5173 (or 5175 via the configured launch)
```
Type to climb. `Esc` restart · `Tab` new passage · 🎧 headphones recommended.

## Controls / rules
- Only the **correct** next key advances you (you can't climb on a bad key).
- Wrong key = dry dud, accuracy + flow penalty, no movement. Backspace is a no-op (nothing to fix).
