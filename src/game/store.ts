import { create } from "zustand"
import { generatePassage } from "./passage"
import { objectFor, weatherFor, layoutAngles, passageArc, coinAt, type ClimbObject, type Weather } from "./config"
import { SKINS, DEFAULT_SKIN, skinById } from "./skins"

/** Per-letter state: 0 = untyped, 1 = correct, 2 = wrong (red). */
export type Mark = 0 | 1 | 2

export interface PressResult {
  kind: "correct" | "error" | "jump" | "backspace" | "none"
  slip: boolean // a fall was triggered by this keystroke
  worldIndex: number // absolute word index the caret is in (after the press)
  object: ClimbObject
  slot: number // caret slot within the word (for pitch/pan)
  flow: number
}

// reds needed to slip & fall (?clumsy makes every red a fall, for testing)
const RED_LIMIT =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("clumsy") ? 1 : 3

export type GameMode = "zen" | 15 | 30
export type Phase = "idle" | "running" | "done"

export interface RunResults {
  mode: GameMode
  wpm: number
  raw: number
  acc: number
  correct: number
  errors: number
  height: number
  bestStreak: number
}

function loadMode(): GameMode {
  try {
    const raw = localStorage.getItem("thock-mode")
    if (raw === "15") return 15
    if (raw === "30") return 30
  } catch {}
  return "zen"
}

interface GameState {
  words: string[] // current passage, split into words
  marks: Mark[][] // per word, per letter
  wi: number // current word index within the passage
  ci: number // caret index within the current word
  baseWord: number // words completed in earlier passages (endless)
  angles: number[] // per-word center angle on the spiral (length-aware spacing)
  arcBase: number // arc where the current passage starts (carries the spiral forward)
  seed: number // world offset — randomizes materials/weather per run
  freshReds: number // errors since the last fall (fall at RED_LIMIT)
  errors: number
  keystrokes: number
  streak: number
  bestStreak: number
  flow: number
  startTime: number | null
  mode: GameMode
  phase: Phase
  results: RunResults | null
  weather: Weather
  prevWeather: Weather
  weatherAt: number
  keycap: "mt3" | "xda"
  character: CharacterLook
  slipNonce: number // increments on every fall — visuals sequence off this
  slipAt: number
  coins: number // total balance (persisted)
  ownedSkins: string[] // skin ids the player owns (persisted)
  collected: Record<number, true> // world indices whose coin was grabbed this run
  coinNonce: number // bumps on each pickup — pickup chime/pop sequence off this

  reset: () => void
  press: (char: string) => PressResult | null
  backspace: () => PressResult | null
  endRun: () => void
  setMode: (m: GameMode) => void
  toggleKeycap: () => void
  setChar: (part: keyof CharacterLook, value: string) => void
  collectCoin: (worldIndex: number) => void
  buySkin: (id: string) => void
  equipSkin: (id: string) => void
}

export interface CharacterLook {
  skin: string // equipped skin id
  fur: string
  accent: string
}

const DEFAULT_CHAR: CharacterLook = { skin: DEFAULT_SKIN, fur: SKINS[0].fur, accent: SKINS[0].accent }

function loadChar(): CharacterLook {
  try {
    const raw = localStorage.getItem("thock-char-v2")
    if (raw) return { ...DEFAULT_CHAR, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_CHAR
}

function loadCoins(): number {
  try {
    const raw = localStorage.getItem("thock-coins")
    if (raw) return Math.max(0, parseInt(raw, 10) || 0)
  } catch {}
  return 0
}

function loadOwned(): string[] {
  try {
    const raw = localStorage.getItem("thock-owned-v1")
    if (raw) return Array.from(new Set([DEFAULT_SKIN, ...JSON.parse(raw)]))
  } catch {}
  return [DEFAULT_SKIN]
}

const FLOW_GAIN = 0.045
const FLOW_LOSS = 0.25

const newSeed = () => Math.floor(Math.random() * 997)

function fresh(arcBase = 0) {
  const passage = generatePassage()
  const words = passage.split(" ")
  return {
    words,
    marks: words.map((w) => Array<Mark>(w.length).fill(0)),
    wi: 0,
    ci: 0,
    baseWord: 0,
    angles: layoutAngles(words, arcBase),
    arcBase,
  }
}

const seed0 = newSeed()

export const useGame = create<GameState>((set, get) => ({
  ...fresh(),
  seed: seed0,
  freshReds: 0,
  errors: 0,
  keystrokes: 0,
  streak: 0,
  bestStreak: 0,
  flow: 0,
  startTime: null,
  mode: loadMode(),
  phase: "idle",
  results: null,
  weather: weatherFor(seed0),
  prevWeather: weatherFor(seed0),
  weatherAt: 0,
  keycap: "mt3",
  character: loadChar(),
  slipNonce: 0,
  slipAt: 0,
  coins: loadCoins(),
  ownedSkins: loadOwned(),
  collected: {},
  coinNonce: 0,

  toggleKeycap: () => set((s) => ({ keycap: s.keycap === "mt3" ? "xda" : "mt3" })),

  /** Grab the coin floating over `worldIndex` (once per run per platform). */
  collectCoin: (worldIndex) =>
    set((s) => {
      if (s.collected[worldIndex] || !coinAt(worldIndex, s.seed)) return {}
      const coins = s.coins + 1
      try {
        localStorage.setItem("thock-coins", String(coins))
      } catch {}
      return { coins, collected: { ...s.collected, [worldIndex]: true }, coinNonce: s.coinNonce + 1 }
    }),

  /** Buy a skin if affordable & not owned; deduct coins and unlock it. */
  buySkin: (id) =>
    set((s) => {
      const skin = skinById(id)
      if (s.ownedSkins.includes(id) || s.coins < skin.price) return {}
      const coins = s.coins - skin.price
      const ownedSkins = [...s.ownedSkins, id]
      try {
        localStorage.setItem("thock-coins", String(coins))
        localStorage.setItem("thock-owned-v1", JSON.stringify(ownedSkins))
      } catch {}
      return { coins, ownedSkins }
    }),

  /** Equip an owned skin — resets fur/accent to the skin's own palette. */
  equipSkin: (id) =>
    set((s) => {
      if (!s.ownedSkins.includes(id)) return {}
      const skin = skinById(id)
      const character: CharacterLook = { skin: id, fur: skin.fur, accent: skin.accent }
      try {
        localStorage.setItem("thock-char-v2", JSON.stringify(character))
      } catch {}
      return { character }
    }),

  setChar: (part, value) =>
    set((s) => {
      const character = { ...s.character, [part]: value }
      try {
        localStorage.setItem("thock-char-v2", JSON.stringify(character))
      } catch {}
      return { character }
    }),

  setMode: (m) => {
    try {
      localStorage.setItem("thock-mode", String(m))
    } catch {}
    set({ mode: m })
    get().reset()
  },

  reset: () => {
    const seed = newSeed() // a fresh random world every run
    set({
      ...fresh(),
      seed,
      freshReds: 0,
      errors: 0,
      keystrokes: 0,
      streak: 0,
      bestStreak: 0,
      flow: 0,
      startTime: null,
      phase: "idle",
      results: null,
      weather: weatherFor(seed),
      prevWeather: weatherFor(seed),
      weatherAt: 0,
      collected: {},
    })
  },

  /** Timed run over: freeze input and snapshot MonkeyType-style results. */
  endRun: () => {
    const s = get()
    if (s.phase !== "running") return
    const minutes = s.startTime ? Math.max((Date.now() - s.startTime) / 60000, 1e-6) : 1e-6
    const correct = Math.max(0, s.keystrokes - s.errors)
    set({
      phase: "done",
      results: {
        mode: s.mode,
        wpm: Math.round(correct / 5 / minutes),
        raw: Math.round(s.keystrokes / 5 / minutes),
        acc: s.keystrokes ? Math.round((correct / s.keystrokes) * 100) : 100,
        correct,
        errors: s.errors,
        height: heightMeters(s),
        bestStreak: s.bestStreak,
      },
    })
  },

  press: (char) => {
    const s = get()
    if (s.phase === "done") return null
    const word = s.words[s.wi]
    if (word === undefined) return null
    const startTime = s.startTime ?? Date.now()
    const phase: Phase = "running"
    const W = s.baseWord + s.wi
    const oF = (i: number) => objectFor(i + s.seed)

    // ---- space: complete/skip the word, jump to the next platform ----
    if (char === " ") {
      if (s.ci === 0)
        return { kind: "none", slip: false, worldIndex: W, object: oF(W), slot: s.ci, flow: s.flow }

      // remainder of the word is skipped -> marked red (counts once toward falls)
      const marks = s.marks.map((m) => [...m])
      let skipped = 0
      for (let i = s.ci; i < word.length; i++) {
        if (marks[s.wi][i] === 0) {
          marks[s.wi][i] = 2
          skipped++
        }
      }
      const freshReds = s.freshReds + (skipped > 0 ? 1 : 0)
      const keystrokes = s.keystrokes + 1

      if (freshReds >= RED_LIMIT && s.wi >= 1) {
        return doFall(set, s, { marks, keystrokes, startTime, errors: s.errors + skipped })
      }

      // advance to the next word (roll a fresh passage at the end)
      let wi = s.wi + 1
      let words = s.words
      let baseWord = s.baseWord
      let nextMarks = marks
      let angles = s.angles
      let arcBase = s.arcBase
      if (wi >= words.length) {
        baseWord += words.length
        arcBase = s.arcBase + passageArc(s.words) // continue the spiral
        const f = fresh(arcBase)
        words = f.words
        nextMarks = f.marks
        angles = f.angles
        wi = 0
      }
      const nextW = baseWord + wi
      const nextWeather = weatherFor(nextW + s.seed)
      const changed = nextWeather.name !== s.weather.name
      const streak = skipped ? 0 : s.streak + 1
      set({
        words,
        marks: nextMarks,
        angles,
        arcBase,
        wi,
        ci: 0,
        baseWord,
        freshReds,
        keystrokes,
        errors: s.errors + skipped,
        startTime,
        phase,
        flow: skipped ? Math.max(0, s.flow - FLOW_LOSS) : Math.min(1, s.flow + FLOW_GAIN),
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
        weather: nextWeather,
        prevWeather: changed ? s.weather : s.prevWeather,
        weatherAt: changed ? Date.now() : s.weatherAt,
      })
      return { kind: "jump", slip: false, worldIndex: nextW, object: oF(nextW), slot: 0, flow: get().flow }
    }

    // ---- letters: MonkeyType style — type through, wrong = red ----
    if (s.ci >= word.length) {
      // at the word's end only space (or backspace) does anything
      return { kind: "none", slip: false, worldIndex: W, object: oF(W), slot: s.ci, flow: s.flow }
    }

    const ok = char === word[s.ci]
    const marks = s.marks.map((m) => [...m])
    marks[s.wi][s.ci] = ok ? 1 : 2
    const ci = s.ci + 1
    const keystrokes = s.keystrokes + 1

    if (ok) {
      const streak = s.streak + 1
      set({
        marks,
        ci,
        keystrokes,
        startTime,
        phase,
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
        flow: Math.min(1, s.flow + FLOW_GAIN),
      })
      return { kind: "correct", slip: false, worldIndex: W, object: oF(W), slot: s.ci, flow: get().flow }
    }

    const freshReds = s.freshReds + 1
    if (freshReds >= RED_LIMIT && s.wi >= 1) {
      return doFall(set, s, { marks, keystrokes, startTime, errors: s.errors + 1 })
    }
    set({
      marks,
      ci,
      keystrokes,
      startTime,
      phase,
      freshReds,
      errors: s.errors + 1,
      streak: 0,
      flow: Math.max(0, s.flow - FLOW_LOSS),
    })
    return { kind: "error", slip: false, worldIndex: W, object: oF(W), slot: s.ci, flow: get().flow }
  },

  /** Backspace: step back within the current word; deleting a red un-counts it. */
  backspace: () => {
    const s = get()
    if (s.phase === "done") return null
    if (s.ci === 0) return null
    const ci = s.ci - 1
    const marks = s.marks.map((m) => [...m])
    const wasRed = marks[s.wi][ci] === 2
    marks[s.wi][ci] = 0
    set({
      marks,
      ci,
      freshReds: wasRed ? Math.max(0, s.freshReds - 1) : s.freshReds,
    })
    const W = s.baseWord + s.wi
    return { kind: "backspace", slip: false, worldIndex: W, object: objectFor(W + s.seed), slot: ci, flow: s.flow }
  },
}))

/** Tumble back 1-2 words; fallen words reset and must be retyped. */
function doFall(
  set: (partial: Partial<GameState>) => void,
  s: GameState,
  extra: { marks: Mark[][]; keystrokes: number; startTime: number; errors: number }
): PressResult {
  const fall = Math.min(s.wi, Math.random() < 0.5 ? 2 : 1)
  const wi = s.wi - fall
  const marks = extra.marks
  for (let i = wi; i <= s.wi; i++) marks[i] = Array<Mark>(s.words[i].length).fill(0)
  const nextW = s.baseWord + wi
  const nextWeather = weatherFor(nextW + s.seed)
  const changed = nextWeather.name !== s.weather.name
  set({
    marks,
    wi,
    ci: 0,
    freshReds: 0,
    keystrokes: extra.keystrokes,
    errors: extra.errors,
    startTime: extra.startTime,
    phase: "running",
    streak: 0,
    flow: Math.max(0, s.flow - FLOW_LOSS),
    weather: nextWeather,
    prevWeather: changed ? s.weather : s.prevWeather,
    weatherAt: changed ? Date.now() : s.weatherAt,
    slipNonce: s.slipNonce + 1,
    slipAt: Date.now(),
  })
  return {
    kind: "error",
    slip: true,
    worldIndex: nextW,
    object: objectFor(nextW + s.seed),
    slot: 0,
    flow: Math.max(0, s.flow - FLOW_LOSS),
  }
}

// --- Derived selectors ---
export function wpm(s: GameState): number {
  if (!s.startTime) return 0
  const minutes = (Date.now() - s.startTime) / 60000
  if (minutes <= 0) return 0
  return Math.max(0, Math.round((s.keystrokes - s.errors) / 5 / minutes))
}

export function accuracy(s: GameState): number {
  if (s.keystrokes === 0) return 100
  return Math.round(((s.keystrokes - s.errors) / s.keystrokes) * 100)
}

export function heightMeters(s: GameState): number {
  return Math.round((s.baseWord + s.wi) * 1.05)
}

// dev-only: expose the store so previews can jump to a material zone
if (import.meta.env.DEV && typeof window !== "undefined") {
  ;(window as unknown as { useGame: typeof useGame }).useGame = useGame
}
