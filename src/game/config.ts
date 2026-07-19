// Shared geometry, object/material, weather, and musical constants for the climb.

// --- Word-based climb: one word = one object; blob runs across its letters ---
export const GAP = 1.0 // spacing between letters within a word-object
export const WORD_RADIUS = 5.5 // spiral radius of word rows
export const WORD_RISE = 1.05 // vertical gain per word
export const WORD_PAD = 1.3 // arc gap (world units) between adjacent word platforms
export const ZONE_SIZE = 3 // words per material zone
export const WEATHER_SIZE = 9 // words per weather (3 material zones)

/**
 * Length-aware cumulative angle for each word. Every word claims arc on the
 * loop proportional to its own length (+ a constant pad), so long words no
 * longer overrun their neighbors — platform gaps stay equal regardless of
 * word length. Returns the center angle (radians) per word.
 */
export function layoutAngles(words: string[], startArc = 0): number[] {
  const angles: number[] = []
  let arc = startArc
  for (const w of words) {
    const half = ((w.length - 1) / 2) * GAP
    angles.push((arc + half) / WORD_RADIUS)
    arc += w.length * GAP + WORD_PAD
  }
  return angles
}

/** Total arc a passage consumes — used to continue the spiral into the next one. */
export function passageArc(words: string[]): number {
  let arc = 0
  for (const w of words) arc += w.length * GAP + WORD_PAD
  return arc
}

export function wordRotationY(angle: number): number {
  return -(angle + Math.PI / 2)
}

export function wordCenter(angle: number, heightIndex: number): [number, number, number] {
  return [Math.cos(angle) * WORD_RADIUS, heightIndex * WORD_RISE, Math.sin(angle) * WORD_RADIUS]
}

/** World position of letter-slot `s` (fractional ok) within a word at `angle`, length `len`. */
export function slotWorldPos(angle: number, heightIndex: number, s: number, len: number): [number, number, number] {
  const rot = wordRotationY(angle)
  const localX = (s - (len - 1) / 2) * GAP
  const cx = Math.cos(angle) * WORD_RADIUS
  const cz = Math.sin(angle) * WORD_RADIUS
  return [cx + localX * Math.cos(rot), heightIndex * WORD_RISE, cz - localX * Math.sin(rot)]
}

export function panForWord(angle: number): number {
  return Math.cos(angle)
}

// Coins are deliberately RARE — roughly 1 in 14 platforms carries one — so the
// pricier shop skins take a long climb to afford. Deterministic per world index
// (+ run seed) so a coin sits in the same spot if you fall back and re-climb.
export const COIN_CHANCE = 0.07
export function coinAt(worldIndex: number, seed: number): boolean {
  if (worldIndex < 3) return false // clean opening stretch
  const h = Math.sin((worldIndex * 127.1 + seed * 311.7) * 0.7) * 43758.5453
  return (h - Math.floor(h)) < COIN_CHANCE
}

/** Interpolate two "#rrggbb" colors. */
export function hexLerp(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`
}

export type MaterialSound =
  | "thock" | "squish" | "gel" | "foam" | "pop"
  | "snap" | "butter" | "marsh" | "ice" | "honey" | "slime"
export type Shape =
  | "keycap" | "jelly" | "chocolate" | "butter" | "marshmallow"
  | "bubble" | "ice" | "honey" | "slime"
export type Impact = "click" | "soft" | "snap"

/** A climbable object type — its look, its shape, and its ASMR sound recipe. */
export interface ClimbObject {
  name: string
  shape: Shape
  color: string
  ink: string
  roughness: number
  transmission: number
  metalness: number
  halfHeight: number
  sound: MaterialSound
  impact: Impact
}

export const OBJECTS: ClimbObject[] = [
  { name: "keycap", shape: "keycap", color: "#eceaf5", ink: "#2b2038", roughness: 0.4, transmission: 0, metalness: 0, halfHeight: 0.3, sound: "thock", impact: "click" },
  { name: "jelly", shape: "jelly", color: "#ff77b3", ink: "#5a1338", roughness: 0.06, transmission: 0.62, metalness: 0, halfHeight: 0.46, sound: "squish", impact: "soft" },
  { name: "chocolate", shape: "chocolate", color: "#6b3d1c", ink: "#f2d9b8", roughness: 0.24, transmission: 0, metalness: 0.1, halfHeight: 0.22, sound: "snap", impact: "snap" },
  { name: "butter", shape: "butter", color: "#f7dc79", ink: "#7a5a12", roughness: 0.55, transmission: 0.05, metalness: 0, halfHeight: 0.25, sound: "butter", impact: "soft" },
  { name: "marshmallow", shape: "marshmallow", color: "#fff4ec", ink: "#c07d95", roughness: 1, transmission: 0, metalness: 0, halfHeight: 0.5, sound: "marsh", impact: "soft" },
  { name: "bubble", shape: "bubble", color: "#ffffff", ink: "#1c4a78", roughness: 0, transmission: 1, metalness: 0, halfHeight: 0.46, sound: "pop", impact: "soft" },
  { name: "ice", shape: "ice", color: "#dff4ff", ink: "#2f6f9e", roughness: 0.03, transmission: 0.9, metalness: 0, halfHeight: 0.42, sound: "ice", impact: "snap" },
  { name: "honey", shape: "honey", color: "#ffb52a", ink: "#5a3200", roughness: 0.06, transmission: 0.5, metalness: 0, halfHeight: 0.3, sound: "honey", impact: "soft" },
  { name: "slime", shape: "slime", color: "#7ad85f", ink: "#245c19", roughness: 0.05, transmission: 0.55, metalness: 0, halfHeight: 0.4, sound: "slime", impact: "soft" },
]

export function objectFor(worldIndex: number): ClimbObject {
  const zone = Math.floor(Math.max(0, worldIndex) / ZONE_SIZE)
  return OBJECTS[zone % OBJECTS.length]
}

// --- Weather / seasons: cutesy pastel skies that shift as you climb ---
export type Particle = "sparkle" | "rain" | "snow" | "petal"
export interface Weather {
  name: string
  sky: [string, string, string] // gradient: top, mid, bottom
  fog: string
  tint: string // rim-light tint
  particle: Particle
}

export const WEATHERS: Weather[] = [
  { name: "sunny", sky: ["#add8ff", "#d6ecff", "#fff3dc"], fog: "#dbecfb", tint: "#fff0c4", particle: "sparkle" },
  { name: "rainy", sky: ["#8290ab", "#a6b2c4", "#c9d2dd"], fog: "#aab6c6", tint: "#bcd4ec", particle: "rain" },
  { name: "snowy", sky: ["#d3d9f0", "#e9edfb", "#fbfdff"], fog: "#e6eaf7", tint: "#eaf3ff", particle: "snow" },
  { name: "sunset", sky: ["#ff9a76", "#ff6f91", "#9a6bd6"], fog: "#cf8bb4", tint: "#ffcf9e", particle: "petal" },
]

export function weatherFor(worldIndex: number): Weather {
  const i = Math.floor(Math.max(0, worldIndex) / WEATHER_SIZE)
  return WEATHERS[i % WEATHERS.length]
}

/** Top face height objects are anchored to, so the blob always lands cleanly. */
export const TOP_Y = 0.25

// --- Musicality: rising minor-pentatonic motif ---
const BASE_FREQ = 196 // G3
const PENTATONIC = [0, 3, 5, 7, 10]
const OCTAVES = 2

export function freqFor(worldIndex: number): number {
  const span = PENTATONIC.length * OCTAVES
  const step = ((worldIndex % span) + span) % span
  const octave = Math.floor(step / PENTATONIC.length)
  const semitone = PENTATONIC[step % PENTATONIC.length] + 12 * octave
  return BASE_FREQ * Math.pow(2, semitone / 12)
}
