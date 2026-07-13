import { create } from "zustand"
import { generatePassage } from "./passage"
import { materialFor, type Material } from "./config"

export interface PressResult {
  correct: boolean
  worldIndex: number // absolute keycap index just landed on (if correct)
  material: Material
  flow: number
}

interface GameState {
  passage: string
  typed: number // correctly-typed chars in the current passage (= cursor)
  baseOffset: number // keycaps climbed in previous passages (for endless spiral)
  errors: number
  keystrokes: number
  streak: number
  flow: number // 0..1
  startTime: number | null

  reset: () => void
  press: (char: string) => PressResult | null
}

const FLOW_GAIN = 0.045 // per correct key
const FLOW_LOSS = 0.25 // on error

export const useGame = create<GameState>((set, get) => ({
  passage: generatePassage(),
  typed: 0,
  baseOffset: 0,
  errors: 0,
  keystrokes: 0,
  streak: 0,
  flow: 0,
  startTime: null,

  reset: () =>
    set({
      passage: generatePassage(),
      typed: 0,
      baseOffset: 0,
      errors: 0,
      keystrokes: 0,
      streak: 0,
      flow: 0,
      startTime: null,
    }),

  press: (char) => {
    const s = get()
    const expected = s.passage[s.typed]
    if (expected === undefined) return null

    const startTime = s.startTime ?? Date.now()
    const keystrokes = s.keystrokes + 1

    // Wrong key: no advance (you can't climb on a bad key), drop flow, dud sound.
    if (char !== expected) {
      set({
        errors: s.errors + 1,
        keystrokes,
        streak: 0,
        flow: Math.max(0, s.flow - FLOW_LOSS),
        startTime,
      })
      return { correct: false, worldIndex: s.baseOffset + s.typed, material: materialFor(s.baseOffset + s.typed), flow: get().flow }
    }

    // Correct key: advance one keycap.
    const worldIndex = s.baseOffset + s.typed
    let typed = s.typed + 1
    let baseOffset = s.baseOffset
    let passage = s.passage

    // Passage complete -> roll into a fresh one, keep spiraling upward (endless).
    if (typed >= passage.length) {
      baseOffset = baseOffset + typed
      passage = generatePassage()
      typed = 0
    }

    const flow = Math.min(1, s.flow + FLOW_GAIN)
    set({ typed, baseOffset, passage, keystrokes, streak: s.streak + 1, flow, startTime })

    return { correct: true, worldIndex, material: materialFor(worldIndex), flow }
  },
}))

// --- Derived selectors ---
export function wpm(s: GameState): number {
  if (!s.startTime) return 0
  const minutes = (Date.now() - s.startTime) / 60000
  if (minutes <= 0) return 0
  const correct = s.keystrokes - s.errors
  return Math.max(0, Math.round(correct / 5 / minutes))
}

export function accuracy(s: GameState): number {
  if (s.keystrokes === 0) return 100
  return Math.round(((s.keystrokes - s.errors) / s.keystrokes) * 100)
}

export function heightMeters(s: GameState): number {
  return Math.round((s.baseOffset + s.typed) * 0.72)
}
