# Typemaxxing — Design Brief

**A chill-first 3D ASMR typing climber.** MonkeyType rules over a candy world: you type a
passage MonkeyType-style (wrong keys type through in red; backspace to fix), while a 2D
pixel-art critter walks/runs across continuous word-platforms on an endless spiral tower —
legs animate by your live WPM, Space jumps to the next platform. Every correct key fires the
layered pentatonic, spatial material sound of the platform you're on.

> This document is kept in sync with the running implementation. Where an older brief
> contradicted the code, the code won. See **v1.1 corrections** at the bottom.

## Locked design decisions
- **Core vibe:** chill-first; scores optional (no hard fail in Zen).
- **Coupling:** caret-synced — the critter walks the current word-platform to your caret; Space = jump.
- **World:** endless ascending **spiral** of continuous word-platforms (one word = one platform), material **zones/biomes**, dynamic weather.
- **Character:** customizable 2D **pixel animals** (side-profile; idle/walk/run/air frames). Roster: cat (free starter), fox, bunny, panda, frog, penguin — each a distinct critter, not a recolor. Cat/fox fur is recolorable. (The old "scarf" accessory was removed in v1.1 for consistency across animals.)
- **Miss:** MonkeyType — wrong key types through **red**, backspace deletes. **Falls** (slip back 1–2 words, retype them) happen in **sprints**, and in Zen only if *strict falls* is enabled. `?clumsy` lowers the fall threshold to 1 (debug).
- **Cosmetics-only, no pay-to-win:** climbers are unlocked with **coins** earned by climbing, spent in a **gacha** (Crossy-Road-style crank). No real-money mechanics.

### Audio (the soul)
- Two layers per keystroke: mechanical **switch thock** + **material squish**, on independent volume buses.
- **Pentatonic-tuned** so flowing text plays a rising melody (never dissonant).
- **Spatial 3D** (Web Audio HRTF panner), stereo width adjustable — headphones-first.
- **Flow meter**: clean streaks → juicier reverb/warmth; breaking it snaps back dry.
- Switchable **ambience bed** per weather. Assets = **hybrid**: procedural synthesis by default, optional CC0 samples via `/public/sounds/manifest.json`.
- Audio starts only on the first user keystroke (autoplay-safe). Master/mech/material/ambience/reverb/stereo/mute are all in Settings and persist.

### Modes
- **Zen** — endless, no timer, chill by default (error = dud + Flow loss, no fall). *Finish* ends the session and shows results.
- **Sprints** — 15 / 30 / 60 / 120s, WPM + accuracy competition, falls on 3 fresh errors.
- The run clock pauses on tab-hidden / input-blur so blur never eats a sprint.

### Statistics (MonkeyType-aligned, pure functions in `game/stats.ts`)
- raw WPM = (correct + incorrect) ÷ 5 ÷ min · net WPM = correct ÷ 5 ÷ min.
- accuracy = correct / (correct + incorrect + missed), clamped **0–100** (never negative).
- Counters: correctTyped, incorrectTyped, correctedErrors, uncorrectedErrors, missedCharacters, extraCharacters, physicalKeystrokes. Missed characters lower accuracy only (not typed → not in raw/net WPM).

## Onboarding & settings
- Skippable ≤20s **interactive** first-run tutorial (type → space → backspace → Flow → coins) with a stereo test; completion persisted (`tutorialSeen`), replayable from Settings.
- **Settings** dialog: audio mix, visual quality/reduced-motion/shadows/particles/pixel-cap, gameplay toggles (strict falls, show WPM/acc/height/Flow, passage type).

## Persistence
Versioned blob `localStorage["typemaxxing:v1"]` (`game/persist.ts`): coins, ownedSkins,
character, mode, keycap, settings, tutorialSeen, checkpointBest, bestWpm, history (bounded
50). Legacy `thock-*` keys migrate in once, non-destructively. Firebase mirrors
coins/skins/character to the cloud when signed in.

## Tech
Vite + React 19 + TypeScript · **React Three Fiber** (`@react-three/fiber`, `drei`) ·
**Web Audio API** (custom engine) · **Zustand** · Firebase (optional). Tests: **Vitest**.

## Code map
- `game/config.ts` — spiral geometry, materials/zones, pentatonic scale, pan helper.
- `game/store.ts` — Zustand state + `press()`/`backspace()`, `newRun`/`retryRun`, `endRun`/`finishSession`, pause clock, gacha `pull()`.
- `game/stats.ts` — pure stat functions + `snapshot()`.
- `game/persist.ts` — versioned storage + legacy migration + settings.
- `game/passage.ts` — common-words generator.
- `audio/AudioEngine.ts` — synthesis + samples (thock, squishes, dud, reverb, ambience, buses, HRTF).
- `three/Scene.tsx` · `Tower.tsx` · `WordObject.tsx` / `ObjectMesh.tsx` · `Character.tsx` (pixel sprites) · `Coin.tsx` · `Weather.tsx` — the 3D world.
- `ui/TypingInput.tsx` — focus-managed hidden-textarea input · `Dialog.tsx` — accessible modal shell.
- `ui/Hud.tsx` · `TypingBar.tsx` · `Results.tsx` · `Settings.tsx` · `Onboarding.tsx` · `Customizer.tsx` (gacha + skins).
- `App.tsx` — layout + modal orchestration + pause-aware timers (no global gameplay keydown).

## Run
```bash
npm install
npm run dev     # vite (launch config port 5175)
npm run test    # vitest
npm run build   # tsc -b && vite build
```
Type to climb. `Esc` closes a dialog / unfocuses · `Alt+N` new climb · `Enter` retry (on results) · headphones recommended.

## v1.1 corrections (stale brief → reality)
- Renamed **Thock → Typemaxxing** throughout.
- "One gel blob / no customization" → six pixel animals + gacha + customizer (shipped).
- "3 fresh reds = fall" was universal → now **Zen is fall-free by default**; falls are a sprint/strict mechanic.
- Old "no gacha" progression note → superseded by a **cosmetics-only gacha** (still no pay-to-win).
- Controls footnote claimed "only the correct key advances / wrong key = no movement / backspace no-op" — that was never the shipped behavior; the game is MonkeyType type-through with real backspace repair.
- Code map referenced nonexistent `Keycap.tsx` / `Blob.tsx` and a global keydown; input is now a focus-managed textarea and stats/persist/dialog modules exist.
