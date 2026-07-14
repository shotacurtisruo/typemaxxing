import { create } from "zustand"
import { generatePassage } from "./passage"
import { objectFor, weatherFor, type ClimbObject, type Weather } from "./config"

export interface PressResult {
  correct: boolean
  jump: boolean // true when a space jumped us to the next word-object
  worldIndex: number // absolute word index
  object: ClimbObject
  slot: number // letter slot within the word (for pitch/pan)
  flow: number
}

interface GameState {
  words: string[] // current passage, split into words
  passage: string // joined, for the typing display
  wi: number // current word index within the passage
  ci: number // char index within the current word (== len means awaiting the space jump)
  baseWord: number // words completed in earlier passages (endless)
  typed: number // absolute char index into `passage` (for the caret)
  errors: number
  keystrokes: number
  streak: number
  flow: number
  startTime: number | null
  weather: Weather
  keycap: "mt3" | "xda"

  reset: () => void
  press: (char: string) => PressResult | null
  toggleKeycap: () => void
}

const FLOW_GAIN = 0.045
const FLOW_LOSS = 0.25

function cursorIndex(words: string[], wi: number, ci: number): number {
  let n = 0
  for (let i = 0; i < wi; i++) n += words[i].length + 1 // +1 for the space
  return n + ci
}

function fresh() {
  const passage = generatePassage()
  return { words: passage.split(" "), passage, wi: 0, ci: 0, baseWord: 0, typed: 0 }
}

export const useGame = create<GameState>((set, get) => ({
  ...fresh(),
  errors: 0,
  keystrokes: 0,
  streak: 0,
  flow: 0,
  startTime: null,
  weather: weatherFor(0),
  keycap: "mt3",

  toggleKeycap: () => set((s) => ({ keycap: s.keycap === "mt3" ? "xda" : "mt3" })),

  reset: () =>
    set({ ...fresh(), errors: 0, keystrokes: 0, streak: 0, flow: 0, startTime: null, weather: weatherFor(0) }),

  press: (char) => {
    const s = get()
    const word = s.words[s.wi]
    if (word === undefined) return null

    const expected = s.ci < word.length ? word[s.ci] : " "
    const startTime = s.startTime ?? Date.now()
    const keystrokes = s.keystrokes + 1
    const W = s.baseWord + s.wi

    // wrong key: no advance, drop flow, dud
    if (char !== expected) {
      set({ errors: s.errors + 1, keystrokes, streak: 0, flow: Math.max(0, s.flow - FLOW_LOSS), startTime })
      return { correct: false, jump: false, worldIndex: W, object: objectFor(W), slot: s.ci, flow: get().flow }
    }

    const flow = Math.min(1, s.flow + FLOW_GAIN)
    const streak = s.streak + 1

    // running across the current word
    if (s.ci < word.length) {
      const ci = s.ci + 1
      set({ ci, typed: cursorIndex(s.words, s.wi, ci), keystrokes, streak, flow, startTime })
      return { correct: true, jump: false, worldIndex: W, object: objectFor(W), slot: s.ci, flow }
    }

    // space -> jump to the next word-object
    let wi = s.wi + 1
    let words = s.words
    let passage = s.passage
    let baseWord = s.baseWord
    if (wi >= words.length) {
      baseWord += words.length
      passage = generatePassage()
      words = passage.split(" ")
      wi = 0
    }
    const nextW = baseWord + wi
    const nextWeather = weatherFor(nextW)
    const weather = nextWeather.name !== s.weather.name ? nextWeather : s.weather
    set({
      words, passage, wi, ci: 0, baseWord,
      typed: cursorIndex(words, wi, 0),
      keystrokes, streak, flow, startTime, weather,
    })
    return { correct: true, jump: true, worldIndex: nextW, object: objectFor(nextW), slot: 0, flow }
  },
}))

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
  return Math.round((s.baseWord + s.wi) * 1.5)
}
