// Versioned, namespaced persistence. Everything the player accumulates lives in
// one JSON blob under `typemaxxing:v1`. Legacy `thock-*` keys are migrated in
// once, non-destructively (the old keys are left untouched as a safety net).

export type Quality = "auto" | "low" | "medium" | "high"
export type PassageType = "words" | "quotes" | "punctuation" | "numbers" | "code" | "custom" | "weak"
export type PersistMode = "zen" | 15 | 30 | 60 | 120

export interface Settings {
  // audio
  masterVolume: number // 0..1
  mechVolume: number
  materialVolume: number
  ambienceVolume: number
  reverb: number // 0..1
  stereoWidth: number // 0..1
  muted: boolean
  // visual
  quality: Quality
  reducedMotion: boolean
  staticCamera: boolean
  cameraShake: boolean
  particleDensity: number // 0..1
  shadows: boolean
  pixelRatioCap: number // 1..2
  // gameplay
  strictFalls: boolean // Zen: fall on 3 reds like sprints
  showWpm: boolean
  showAcc: boolean
  showHeight: boolean
  showFlow: boolean
  passageType: PassageType
}

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.9,
  mechVolume: 1,
  materialVolume: 1,
  ambienceVolume: 0.6,
  reverb: 0.5,
  stereoWidth: 1,
  muted: false,
  quality: "auto",
  reducedMotion: false,
  staticCamera: false,
  cameraShake: true,
  particleDensity: 1,
  shadows: true,
  pixelRatioCap: 2,
  strictFalls: false,
  showWpm: true,
  showAcc: true,
  showHeight: true,
  showFlow: true,
  passageType: "words",
}

export interface RunHistoryEntry {
  at: number // epoch ms
  mode: PersistMode
  wpm: number
  raw: number
  acc: number
  height: number
}

export interface PersistState {
  coins: number
  ownedSkins: string[]
  character: { skin: string; fur: string; accent: string }
  mode: PersistMode
  keycap: "mt3" | "xda"
  settings: Settings
  tutorialSeen: boolean
  checkpointBest: number
  bestWpm: number
  history: RunHistoryEntry[]
}

const NS = "typemaxxing:v1"
const HISTORY_CAP = 50
export const DEFAULT_CHARACTER = { skin: "cat", fur: "#e0561e", accent: "#5ff0d0" }

function defaults(): PersistState {
  return {
    coins: 0,
    ownedSkins: ["cat"],
    character: { ...DEFAULT_CHARACTER },
    mode: "zen",
    keycap: "mt3",
    settings: { ...DEFAULT_SETTINGS },
    tutorialSeen: false,
    checkpointBest: 0,
    bestWpm: 0,
    history: [],
  }
}

function ls(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null
  } catch {
    return null
  }
}

function readRaw(): Partial<PersistState> | null {
  const store = ls()
  if (!store) return null
  try {
    const s = store.getItem(NS)
    return s ? (JSON.parse(s) as Partial<PersistState>) : null
  } catch {
    return null
  }
}

/** Pull whatever the pre-v1 `thock-*` keys held into a partial v1 state. */
function migrateLegacy(): Partial<PersistState> {
  const store = ls()
  if (!store) return {}
  const out: Partial<PersistState> = {}
  try {
    const coins = store.getItem("thock-coins")
    if (coins != null) out.coins = Math.max(0, parseInt(coins, 10) || 0)
    const owned = store.getItem("thock-owned-v1")
    if (owned != null) out.ownedSkins = Array.from(new Set(["cat", ...(JSON.parse(owned) as string[])]))
    const char = store.getItem("thock-char-v2")
    if (char != null) out.character = { ...DEFAULT_CHARACTER, ...(JSON.parse(char) as object) }
    const mode = store.getItem("thock-mode")
    if (mode === "15") out.mode = 15
    else if (mode === "30") out.mode = 30
  } catch {}
  return out
}

function merge(raw: Partial<PersistState>): PersistState {
  const d = defaults()
  return {
    ...d,
    ...raw,
    character: { ...d.character, ...(raw.character ?? {}) },
    ownedSkins: Array.from(new Set(["cat", ...(raw.ownedSkins ?? d.ownedSkins)])),
    settings: { ...d.settings, ...(raw.settings ?? {}) },
    history: Array.isArray(raw.history) ? raw.history.slice(-HISTORY_CAP) : [],
  }
}

let cache: PersistState | null = null

/** Load the full persisted state, migrating legacy keys on first run. */
export function loadState(): PersistState {
  if (cache) return cache
  let raw = readRaw()
  let migrated = false
  if (!raw) {
    raw = migrateLegacy()
    migrated = true
  }
  cache = merge(raw)
  if (migrated) write(cache) // stamp v1 so migration only happens once
  return cache
}

function write(state: PersistState) {
  const store = ls()
  if (!store) return
  try {
    store.setItem(NS, JSON.stringify(state))
  } catch {}
}

/** Shallow-merge a patch into the persisted state (settings merged deeply). */
export function saveState(patch: Partial<PersistState>): PersistState {
  const cur = loadState()
  const next: PersistState = {
    ...cur,
    ...patch,
    character: patch.character ? { ...cur.character, ...patch.character } : cur.character,
    settings: patch.settings ? { ...cur.settings, ...patch.settings } : cur.settings,
    history: patch.history ? patch.history.slice(-HISTORY_CAP) : cur.history,
  }
  cache = next
  write(next)
  return next
}

export function updateSettings(patch: Partial<Settings>): Settings {
  return saveState({ settings: { ...loadState().settings, ...patch } }).settings
}

/** Append a run to the bounded local history. */
export function pushHistory(entry: RunHistoryEntry): RunHistoryEntry[] {
  const cur = loadState()
  const history = [...cur.history, entry].slice(-HISTORY_CAP)
  return saveState({ history }).history
}

/** Reset to a clean guest profile (keeps settings + tutorial-seen). */
export function clearProgress() {
  const cur = loadState()
  saveState({ coins: 0, ownedSkins: ["cat"], character: { ...DEFAULT_CHARACTER }, checkpointBest: 0, bestWpm: 0, history: [] })
  return cur
}

/** Test-only: drop the in-memory cache so a fresh localStorage is re-read. */
export function _resetCache() {
  cache = null
}
