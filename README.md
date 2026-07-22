# Typemaxxing

A chill-first **3D ASMR typing climber**. Each word is a platform on an endless spiral
tower; your climber follows the typing caret, Space jumps to the next word, and clean
typing builds **Flow** while every correct key plays a spatial, pentatonic note.

Live: https://typemaxxing.vercel.app

## Controls

| Key | Action |
| --- | --- |
| letters | type the passage to climb |
| space | jump to the next word (skipping unfinished letters marks them *missed*) |
| backspace | repair a mistake within the current word |
| esc | close the top dialog, or unfocus/pause the run (never destroys it) |
| alt + n | new climb (fresh seed + passage) |
| enter | retry the same climb — only while the results screen is focused |
| tab | normal focus navigation (never hijacked) |

Typing is captured by a focus-managed, visually-hidden `<textarea>` — nothing is read off
`window`, so keys never leak behind a dialog. IME/composition and non-US layouts are
handled. Click the panel (or the "click to resume" pill) to refocus.

## Modes

- **Zen** — endless, no timer, **no forced falls by default** (an error is a dud + Flow
  loss). Turn on *strict falls* in settings for the challenge, and use **Finish** to end a
  session and see results.
- **Sprints** — 15s / 30s / 60s / 120s, WPM + accuracy competition. Three fresh errors make
  the climber slip and fall back 1–2 words (a signature mechanic; configurable via strict
  falls).

The run clock pauses when the tab is hidden or the input loses focus, so blur never eats a
sprint.

## Statistics

MonkeyType-aligned, computed by pure functions in [`src/game/stats.ts`](src/game/stats.ts):

- **raw WPM** = all typed characters (correct + incorrect) ÷ 5 ÷ minutes
- **net WPM** = correct characters ÷ 5 ÷ minutes
- **accuracy** = `correct / (correct + incorrect + missed)`, always clamped **0–100**
- explicit counters: `correctTyped`, `incorrectTyped`, `correctedErrors`,
  `uncorrectedErrors`, `missedCharacters`, `extraCharacters`, `physicalKeystrokes`

Missed characters (from pressing Space early) never count toward raw/net WPM — they only
lower accuracy — so accuracy can never go negative.

## Architecture

- **React 19 + TypeScript + Vite** — split screen: 3D tower on top, typing panel below.
- **React Three Fiber / Drei / three.js** — spiral tower, per-word material platforms,
  climbing camera, weather, pixel-art climber sprites (canvas → billboarded texture).
- **Zustand** — game state + the `press()` loop ([`src/game/store.ts`](src/game/store.ts)).
- **Custom Web Audio engine** ([`src/audio/AudioEngine.ts`](src/audio/AudioEngine.ts)) —
  layered switch-thock + material squish on independent buses, HRTF spatial panning,
  reverb/ambience that open up with Flow.
- **Firebase** — optional Google sign-in + Firestore cloud save of coins/skins/character.

Key modules: `game/config.ts` (spiral geometry, materials, pentatonic scale), `game/passage.ts`
(word generator), `game/stats.ts` (pure stats), `game/persist.ts` (versioned storage),
`ui/TypingInput.tsx` (input surface), `ui/Dialog.tsx` (accessible modal), `ui/Hud.tsx`,
`ui/Results.tsx`, `ui/Settings.tsx`, `ui/Onboarding.tsx`, `ui/Customizer.tsx` (gacha + skins).

## Accessibility

- Every control has a visible label or SVG icon, `aria-label`, and a `:focus-visible` ring.
- Dialogs are `role="dialog"` + `aria-modal`, focus-trapped, Escape-closable, and restore
  focus to their opener; gameplay input is suppressed while any dialog is open.
- Tab is never intercepted. A **reduced motion** setting is available (P2 wires it deeper
  into the 3D scene).

## Audio notes

Procedural synthesis by default; optional CC0 samples load from `/public/sounds/manifest.json`
(a `{key,file,gain,baseFreq,offset,dur}[]`) and replace a material's synth voice, pitched to
keep the rising melody. Audio only starts on the first user keystroke (autoplay-safe). Volume,
per-layer mix, reverb, stereo width, ambience, and mute are all in Settings and persist.

## Persistence

One versioned JSON blob under `localStorage["typemaxxing:v1"]`
([`src/game/persist.ts`](src/game/persist.ts)):

```
{ coins, ownedSkins[], character{skin,fur,accent}, mode, keycap,
  settings{…audio/visual/gameplay…}, tutorialSeen, checkpointBest, bestWpm, history[] }
```

Legacy `thock-coins` / `thock-owned-v1` / `thock-char-v2` / `thock-mode` keys are migrated in
once, **non-destructively** (the old keys are left in place). Run history is bounded to 50.

## Development

```bash
npm install
npm run dev      # vite dev server
npm run test     # vitest (game logic, stats, persistence, state transitions)
npm run lint     # oxlint
npm run build    # tsc -b && vite build
```

Debug flags: `?clumsy` (fall on a single error), `?gallery` / `?keycaps` / `?design`
(showcase routes).

## Deployment

Static build (`npm run build` → `dist/`) deployed on **Vercel** (https://typemaxxing.vercel.app):
`npx vercel@latest --prod --yes`.
