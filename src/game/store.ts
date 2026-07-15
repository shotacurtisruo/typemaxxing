import { create } from "zustand"
import { generatePassage } from "./passage"
import { objectFor, weatherFor, type ClimbObject, type Weather } from "./config"

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

interface GameState {
  words: string[] // current passage, split into words
  marks: Mark[][] // per word, per letter
  wi: number // current word index within the passage
  ci: number // caret index within the current word
  baseWord: number // words completed in earlier passages (endless)
  freshReds: number // errors since the last fall (fall at RED_LIMIT)
  errors: number
  keystrokes: number
  streak: number
  flow: number
  startTime: number | null
  weather: Weather
  prevWeather: Weather
  weatherAt: number
  keycap: "mt3" | "xda"
  character: CharacterLook
  slipNonce: number // increments on every fall — visuals sequence off this
  slipAt: number

  reset: () => void
  press: (char: string) => PressResult | null
  backspace: () => PressResult | null
  toggleKeycap: () => void
  setChar: (part: keyof CharacterLook, value: string) => void
}

export interface CharacterLook {
  fur: string
  accent: string
}

const DEFAULT_CHAR: CharacterLook = { fur: "#e0561e", accent: "#5ff0d0" }

function loadChar(): CharacterLook {
  try {
    const raw = localStorage.getItem("thock-char-v2")
    if (raw) return { ...DEFAULT_CHAR, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_CHAR
}

const FLOW_GAIN = 0.045
const FLOW_LOSS = 0.25

function fresh() {
  const passage = generatePassage()
  const words = passage.split(" ")
  return {
    words,
    marks: words.map((w) => Array<Mark>(w.length).fill(0)),
    wi: 0,
    ci: 0,
    baseWord: 0,
  }
}

export const useGame = create<GameState>((set, get) => ({
  ...fresh(),
  freshReds: 0,
  errors: 0,
  keystrokes: 0,
  streak: 0,
  flow: 0,
  startTime: null,
  weather: weatherFor(0),
  prevWeather: weatherFor(0),
  weatherAt: 0,
  keycap: "mt3",
  character: loadChar(),
  slipNonce: 0,
  slipAt: 0,

  toggleKeycap: () => set((s) => ({ keycap: s.keycap === "mt3" ? "xda" : "mt3" })),

  setChar: (part, value) =>
    set((s) => {
      const character = { ...s.character, [part]: value }
      try {
        localStorage.setItem("thock-char-v2", JSON.stringify(character))
      } catch {}
      return { character }
    }),

  reset: () =>
    set({
      ...fresh(),
      freshReds: 0,
      errors: 0,
      keystrokes: 0,
      streak: 0,
      flow: 0,
      startTime: null,
      weather: weatherFor(0),
      prevWeather: weatherFor(0),
      weatherAt: 0,
    }),

  /** A slip: tumble back 1-2 words; fallen words must be retyped. */
  press: (char) => {
    const s = get()
    const word = s.words[s.wi]
    if (word === undefined) return null
    const startTime = s.startTime ?? Date.now()
    const W = s.baseWord + s.wi

    // ---- space: complete/skip the word, jump to the next platform ----
    if (char === " ") {
      if (s.ci === 0) return { kind: "none", slip: false, worldIndex: W, object: objectFor(W), slot: s.ci, flow: s.flow }

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
      if (wi >= words.length) {
        baseWord += words.length
        const f = fresh()
        words = f.words
        nextMarks = f.marks
        wi = 0
      }
      const nextW = baseWord + wi
      const nextWeather = weatherFor(nextW)
      const changed = nextWeather.name !== s.weather.name
      set({
        words,
        marks: nextMarks,
        wi,
        ci: 0,
        baseWord,
        freshReds,
        keystrokes,
        errors: s.errors + skipped,
        startTime,
        flow: skipped ? Math.max(0, s.flow - FLOW_LOSS) : Math.min(1, s.flow + FLOW_GAIN),
        streak: skipped ? 0 : s.streak + 1,
        weather: nextWeather,
        prevWeather: changed ? s.weather : s.prevWeather,
        weatherAt: changed ? Date.now() : s.weatherAt,
      })
      return { kind: "jump", slip: false, worldIndex: nextW, object: objectFor(nextW), slot: 0, flow: get().flow }
    }

    // ---- letters: MonkeyType style — type through, wrong = red ----
    if (s.ci >= word.length) {
      // at the word's end only space (or backspace) does anything
      return { kind: "none", slip: false, worldIndex: W, object: objectFor(W), slot: s.ci, flow: s.flow }
    }

    const ok = char === word[s.ci]
    const marks = s.marks.map((m) => [...m])
    marks[s.wi][s.ci] = ok ? 1 : 2
    const ci = s.ci + 1
    const keystrokes = s.keystrokes + 1

    if (ok) {
      set({
        marks,
        ci,
        keystrokes,
        startTime,
        streak: s.streak + 1,
        flow: Math.min(1, s.flow + FLOW_GAIN),
      })
      return { kind: "correct", slip: false, worldIndex: W, object: objectFor(W), slot: s.ci, flow: get().flow }
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
      freshReds,
      errors: s.errors + 1,
      streak: 0,
      flow: Math.max(0, s.flow - FLOW_LOSS),
    })
    return { kind: "error", slip: false, worldIndex: W, object: objectFor(W), slot: s.ci, flow: get().flow }
  },

  /** Backspace: step back within the current word; deleting a red un-counts it. */
  backspace: () => {
    const s = get()
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
    return { kind: "backspace", slip: false, worldIndex: W, object: objectFor(W), slot: ci, flow: s.flow }
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
  const nextWeather = weatherFor(nextW)
  const changed = nextWeather.name !== s.weather.name
  set({
    marks,
    wi,
    ci: 0,
    freshReds: 0,
    keystrokes: extra.keystrokes,
    errors: extra.errors,
    startTime: extra.startTime,
    streak: 0,
    flow: Math.max(0, s.flow - FLOW_LOSS),
    weather: nextWeather,
    prevWeather: changed ? s.weather : s.prevWeather,
    weatherAt: changed ? Date.now() : s.weatherAt,
    slipNonce: s.slipNonce + 1,
    slipAt: Date.now(),
  })
  return { kind: "error", slip: true, worldIndex: nextW, object: objectFor(nextW), slot: 0, flow: Math.max(0, s.flow - FLOW_LOSS) }
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
