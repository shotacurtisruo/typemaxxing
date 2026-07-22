import { create } from "zustand"
import { generatePassage } from "./passage"
import { objectFor, weatherFor, layoutAngles, coinAt, type ClimbObject, type Weather } from "./config"
import { SKINS, DEFAULT_SKIN, skinById, gachaPool, PULL_COST, RARITY_WEIGHT, DUPE_REFUND, type CharacterDef, type Rarity } from "./skins"
import { EMPTY_STATS, netWpm, rawWpm, accuracy as accOf, snapshot, uncorrectedErrors, type Stats } from "./stats"
import { loadState, saveState, updateSettings, pushHistory, clearProgress, type Settings, type PersistMode } from "./persist"

/** Per-letter state: 0 = untyped, 1 = correct, 2 = wrong/missed (red). */
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

// one checkpoint per this many completed words (P1 payoff cadence)
export const CHECKPOINT_EVERY = 22

export type GameMode = PersistMode // "zen" | 15 | 30 | 60 | 120
export type Phase = "idle" | "running" | "done"

export interface RunResults {
  mode: GameMode
  wpm: number
  raw: number
  acc: number
  correctTyped: number
  incorrectTyped: number
  correctedErrors: number
  uncorrectedErrors: number
  missedCharacters: number
  height: number
  bestStreak: number
  checkpoints: number
  coins: number
  pbDelta: number // net wpm vs previous best (can be negative)
  isPb: boolean
}

/** Outcome of one gacha crank. */
export type PullResult =
  | { error: "poor" }
  | { animal: CharacterDef; rarity: Rarity; isNew: boolean; refund: number }

export interface CharacterLook {
  skin: string
  fur: string
  accent: string
}

interface GameState {
  words: string[]
  marks: Mark[][]
  wi: number
  ci: number
  baseWord: number
  angles: number[]
  arcBase: number
  seed: number
  freshReds: number
  stats: Stats
  streak: number
  bestStreak: number
  flow: number
  startTime: number | null
  pausedAt: number | null // when input focus/visibility paused a running clock
  mode: GameMode
  phase: Phase
  results: RunResults | null
  weather: Weather
  prevWeather: Weather
  weatherAt: number
  keycap: "mt3" | "xda"
  character: CharacterLook
  settings: Settings
  slipNonce: number
  slipAt: number
  coins: number
  coinsRun: number // coins collected in the current run (for results)
  ownedSkins: string[]
  collected: Record<number, true>
  coinNonce: number

  newRun: () => void
  retryRun: () => void
  pauseClock: () => void
  resumeClock: () => void
  press: (char: string) => PressResult | null
  backspace: () => PressResult | null
  endRun: () => void
  finishSession: () => void
  setMode: (m: GameMode) => void
  setSettings: (patch: Partial<Settings>) => void
  toggleKeycap: () => void
  setChar: (part: keyof CharacterLook, value: string) => void
  collectCoin: (worldIndex: number) => void
  pull: () => PullResult
  equipSkin: (id: string) => void
  applyCloud: (data: { coins: number; ownedSkins: string[]; character: CharacterLook }) => void
  resetProgress: () => void
}

const FLOW_GAIN = 0.045
const FLOW_LOSS = 0.25
const LOOKAHEAD = 24

const newSeed = () => Math.floor(Math.random() * 997)
const persisted = loadState()

/** Zen is chill by default — falls only happen in a sprint, or if the player
 *  opted into strict falls. `?clumsy` still lowers the threshold for testing. */
function fallsEnabled(mode: GameMode, settings: Settings): boolean {
  return mode !== "zen" || settings.strictFalls
}

function freshMarks(words: string[]): Mark[][] {
  return words.map((w) => Array<Mark>(w.length).fill(0))
}

function extendStream(words: string[], marks: Mark[][], angles: number[], wi: number) {
  if (words.length - wi > LOOKAHEAD) return { words, marks, angles }
  const batch = generatePassage().split(" ")
  const nextWords = words.concat(batch)
  const nextMarks = marks.concat(batch.map((w) => Array<Mark>(w.length).fill(0)))
  return { words: nextWords, marks: nextMarks, angles: layoutAngles(nextWords, 0) }
}

function touchMarks(marks: Mark[][], wi: number): Mark[][] {
  const next = marks.slice()
  next[wi] = [...marks[wi]]
  return next
}

function fresh(arcBase = 0) {
  const passage = generatePassage()
  const words = passage.split(" ")
  return {
    words,
    marks: freshMarks(words),
    wi: 0,
    ci: 0,
    baseWord: 0,
    angles: layoutAngles(words, arcBase),
    arcBase,
  }
}

/** The run-scoped fields reset between attempts (shared by newRun + retryRun). */
function clearedRun() {
  return {
    freshReds: 0,
    stats: { ...EMPTY_STATS },
    streak: 0,
    bestStreak: 0,
    flow: 0,
    startTime: null,
    pausedAt: null,
    phase: "idle" as Phase,
    results: null,
    collected: {},
    coinsRun: 0,
  }
}

const seed0 = newSeed()

export const useGame = create<GameState>((set, get) => ({
  ...fresh(),
  seed: seed0,
  ...clearedRun(),
  mode: persisted.mode,
  weather: weatherFor(seed0),
  prevWeather: weatherFor(seed0),
  weatherAt: 0,
  keycap: persisted.keycap,
  character: persisted.character,
  settings: persisted.settings,
  slipNonce: 0,
  slipAt: 0,
  coins: persisted.coins,
  ownedSkins: persisted.ownedSkins,
  coinNonce: 0,

  toggleKeycap: () =>
    set((s) => {
      const keycap = s.keycap === "mt3" ? "xda" : "mt3"
      saveState({ keycap })
      return { keycap }
    }),

  setSettings: (patch) => set({ settings: updateSettings(patch) }),

  /** Freeze the run clock while the gameplay input is unfocused / tab hidden. */
  pauseClock: () =>
    set((s) => (s.phase === "running" && s.startTime != null && s.pausedAt == null ? { pausedAt: Date.now() } : {})),
  resumeClock: () =>
    set((s) => {
      if (s.pausedAt == null || s.startTime == null) return { pausedAt: null }
      return { startTime: s.startTime + (Date.now() - s.pausedAt), pausedAt: null }
    }),

  /** Grab the coin floating over `worldIndex` (once per run per platform). */
  collectCoin: (worldIndex) =>
    set((s) => {
      if (s.collected[worldIndex] || !coinAt(worldIndex, s.seed)) return {}
      const coins = s.coins + 1
      saveState({ coins })
      return {
        coins,
        coinsRun: s.coinsRun + 1,
        collected: { ...s.collected, [worldIndex]: true },
        coinNonce: s.coinNonce + 1,
      }
    }),

  pull: () => {
    const s = get()
    if (s.coins < PULL_COST) return { error: "poor" }
    const pool = gachaPool()
    const unowned = pool.filter((c) => !s.ownedSkins.includes(c.id))
    const rollRarity = (list: CharacterDef[]): Rarity => {
      const rs = Array.from(new Set(list.map((c) => c.rarity ?? "common"))) as Rarity[]
      const weights = rs.map((r) => RARITY_WEIGHT[r] ?? 1)
      let t = weights.reduce((a, b) => a + b, 0) * Math.random()
      for (let i = 0; i < rs.length; i++) if ((t -= weights[i]) <= 0) return rs[i]
      return rs[rs.length - 1]
    }
    const pickFrom = (list: CharacterDef[], r: Rarity) => {
      const tier = list.filter((c) => (c.rarity ?? "common") === r)
      const from = tier.length ? tier : list
      return from[Math.floor(Math.random() * from.length)]
    }
    const isNew = unowned.length > 0
    const source = isNew ? unowned : pool
    const rarity = rollRarity(source)
    const animal = pickFrom(source, rarity)
    const refund = isNew ? 0 : DUPE_REFUND[animal.rarity ?? "common"] ?? 15
    const coins = s.coins - PULL_COST + refund
    const ownedSkins = isNew ? [...s.ownedSkins, animal.id] : s.ownedSkins
    saveState({ coins, ownedSkins })
    set({ coins, ownedSkins })
    return { animal, rarity: (animal.rarity ?? "common") as Rarity, isNew, refund }
  },

  applyCloud: ({ coins, ownedSkins, character }) => {
    saveState({ coins, ownedSkins, character })
    set({ coins, ownedSkins, character })
  },

  resetProgress: () => {
    clearProgress()
    set({ coins: 0, ownedSkins: [DEFAULT_SKIN], character: { skin: DEFAULT_SKIN, fur: SKINS[0].fur, accent: SKINS[0].accent } })
  },

  equipSkin: (id) =>
    set((s) => {
      const skin = skinById(id)
      if (!s.ownedSkins.includes(id) || skin.enabled === false) return {}
      const character: CharacterLook = { skin: id, fur: skin.fur, accent: skin.accent }
      saveState({ character })
      return { character }
    }),

  setChar: (part, value) =>
    set((s) => {
      const character = { ...s.character, [part]: value }
      saveState({ character })
      return { character }
    }),

  setMode: (m) => {
    saveState({ mode: m })
    set({ mode: m })
    get().newRun()
  },

  /** Fresh world: new seed + new passage. */
  newRun: () => {
    const seed = newSeed()
    set({
      ...fresh(),
      seed,
      ...clearedRun(),
      weather: weatherFor(seed),
      prevWeather: weatherFor(seed),
      weatherAt: 0,
    })
  },

  /** Same climb: keep the exact seed + passage, reset progress + counters. */
  retryRun: () =>
    set((s) => ({
      marks: freshMarks(s.words),
      wi: 0,
      ci: 0,
      baseWord: 0,
      ...clearedRun(),
      weather: weatherFor(s.seed),
      prevWeather: weatherFor(s.seed),
      weatherAt: 0,
    })),

  endRun: () => {
    const s = get()
    if (s.phase !== "running") return
    set({ phase: "done", results: buildResults(s) })
  },

  /** Zen has no timer — let the player end the session and see results. */
  finishSession: () => {
    const s = get()
    if (s.phase !== "running") return
    set({ phase: "done", results: buildResults(s) })
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
    const canFall = fallsEnabled(s.mode, s.settings)

    // ---- space: complete/skip the word, jump to the next platform ----
    if (char === " ") {
      if (s.ci === 0)
        return { kind: "none", slip: false, worldIndex: W, object: oF(W), slot: s.ci, flow: s.flow }

      const marks = touchMarks(s.marks, s.wi)
      let skipped = 0
      for (let i = s.ci; i < word.length; i++) {
        if (marks[s.wi][i] === 0) {
          marks[s.wi][i] = 2
          skipped++
        }
      }
      const freshReds = s.freshReds + (skipped > 0 ? 1 : 0)
      const stats: Stats = {
        ...s.stats,
        missedCharacters: s.stats.missedCharacters + skipped,
        physicalKeystrokes: s.stats.physicalKeystrokes + 1,
      }

      if (canFall && freshReds >= RED_LIMIT && s.wi >= 1) {
        return doFall(set, s, { marks, stats, startTime })
      }

      const wi = s.wi + 1
      const ext = extendStream(s.words, marks, s.angles, wi)
      const nextW = wi
      const nextWeather = weatherFor(nextW + s.seed)
      const changed = nextWeather.name !== s.weather.name
      const streak = skipped ? 0 : s.streak + 1
      set({
        words: ext.words,
        marks: ext.marks,
        angles: ext.angles,
        wi,
        ci: 0,
        freshReds,
        stats,
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
      return { kind: "none", slip: false, worldIndex: W, object: oF(W), slot: s.ci, flow: s.flow }
    }

    const ok = char === word[s.ci]
    const marks = touchMarks(s.marks, s.wi)
    marks[s.wi][s.ci] = ok ? 1 : 2
    const ci = s.ci + 1

    if (ok) {
      const streak = s.streak + 1
      set({
        marks,
        ci,
        stats: { ...s.stats, correctTyped: s.stats.correctTyped + 1, physicalKeystrokes: s.stats.physicalKeystrokes + 1 },
        startTime,
        phase,
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
        flow: Math.min(1, s.flow + FLOW_GAIN),
      })
      return { kind: "correct", slip: false, worldIndex: W, object: oF(W), slot: s.ci, flow: get().flow }
    }

    const freshReds = s.freshReds + 1
    const stats: Stats = {
      ...s.stats,
      incorrectTyped: s.stats.incorrectTyped + 1,
      physicalKeystrokes: s.stats.physicalKeystrokes + 1,
    }
    if (canFall && freshReds >= RED_LIMIT && s.wi >= 1) {
      return doFall(set, s, { marks, stats, startTime })
    }
    set({
      marks,
      ci,
      stats,
      startTime,
      phase,
      freshReds,
      streak: 0,
      flow: Math.max(0, s.flow - FLOW_LOSS),
    })
    return { kind: "error", slip: false, worldIndex: W, object: oF(W), slot: s.ci, flow: get().flow }
  },

  backspace: () => {
    const s = get()
    if (s.phase === "done") return null
    if (s.ci === 0) return null
    const ci = s.ci - 1
    const marks = touchMarks(s.marks, s.wi)
    const wasRed = marks[s.wi][ci] === 2
    marks[s.wi][ci] = 0
    set({
      marks,
      ci,
      freshReds: wasRed ? Math.max(0, s.freshReds - 1) : s.freshReds,
      stats: {
        ...s.stats,
        correctedErrors: wasRed ? s.stats.correctedErrors + 1 : s.stats.correctedErrors,
        physicalKeystrokes: s.stats.physicalKeystrokes + 1,
      },
    })
    const W = s.baseWord + s.wi
    return { kind: "backspace", slip: false, worldIndex: W, object: objectFor(W + s.seed), slot: ci, flow: s.flow }
  },
}))

/** Freeze the current run into results + persist history and personal bests. */
function buildResults(s: GameState): RunResults {
  const end = s.pausedAt ?? Date.now()
  const minutes = s.startTime ? Math.max((end - s.startTime) / 60000, 1e-6) : 1e-6
  const snap = snapshot(s.stats, minutes)
  const height = Math.round((s.baseWord + s.wi) * 1.05)
  const checkpoints = Math.floor((s.baseWord + s.wi) / CHECKPOINT_EVERY)
  const prevBest = loadState().bestWpm
  const isPb = snap.wpm > prevBest
  const pbDelta = snap.wpm - prevBest
  if (isPb) saveState({ bestWpm: snap.wpm })
  pushHistory({ at: Date.now(), mode: s.mode, wpm: snap.wpm, raw: snap.raw, acc: snap.acc, height })
  return {
    mode: s.mode,
    wpm: snap.wpm,
    raw: snap.raw,
    acc: snap.acc,
    correctTyped: snap.correctTyped,
    incorrectTyped: snap.incorrectTyped,
    correctedErrors: snap.correctedErrors,
    uncorrectedErrors: snap.uncorrectedErrors,
    missedCharacters: snap.missedCharacters,
    height,
    bestStreak: s.bestStreak,
    checkpoints,
    coins: s.coinsRun,
    pbDelta,
    isPb,
  }
}

/** Tumble back 1-2 words; fallen words reset and must be retyped. */
function doFall(
  set: (partial: Partial<GameState>) => void,
  s: GameState,
  extra: { marks: Mark[][]; stats: Stats; startTime: number }
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
    stats: extra.stats,
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

// --- Derived selectors (live, clock-based) ---
function liveMinutes(s: GameState): number {
  if (!s.startTime) return 0
  const end = s.pausedAt ?? Date.now()
  return Math.max(0, end - s.startTime) / 60000
}
export function wpm(s: GameState): number {
  return netWpm(s.stats, liveMinutes(s))
}
export function rawWpmLive(s: GameState): number {
  return rawWpm(s.stats, liveMinutes(s))
}
export function accuracy(s: GameState): number {
  return accOf(s.stats)
}
export function heightMeters(s: GameState): number {
  return Math.round((s.baseWord + s.wi) * 1.05)
}
export function checkpointProgress(s: GameState): { reached: number; nextIn: number; frac: number } {
  const total = s.baseWord + s.wi
  const reached = Math.floor(total / CHECKPOINT_EVERY)
  const into = total % CHECKPOINT_EVERY
  return { reached, nextIn: CHECKPOINT_EVERY - into, frac: into / CHECKPOINT_EVERY }
}
export { uncorrectedErrors }

if (import.meta.env.DEV && typeof window !== "undefined") {
  ;(window as unknown as { useGame: typeof useGame }).useGame = useGame
}
