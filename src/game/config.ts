// Shared geometry, material, and musical constants for the climb.

export const ANGLE_STEP = 0.5 // radians between consecutive keycaps
export const RADIUS = 3.2 // spiral radius
export const RISE = 0.72 // vertical gain per keycap
export const ZONE_SIZE = 14 // keycaps per material zone

export type MaterialSound = "squish" | "gel" | "foam" | "pop"

export interface Material {
  name: string
  color: string
  roughness: number
  transmission: number // 0 = opaque, higher = glassy/jelly
  sound: MaterialSound
}

// Zones cycle through these as you climb (see materialFor).
export const MATERIALS: Material[] = [
  { name: "jelly", color: "#ff77b3", roughness: 0.12, transmission: 0.45, sound: "squish" },
  { name: "foam", color: "#ffd9a0", roughness: 0.85, transmission: 0.0, sound: "foam" },
  { name: "gel", color: "#3fd4c4", roughness: 0.08, transmission: 0.5, sound: "gel" },
  { name: "bubble", color: "#7db4ff", roughness: 0.06, transmission: 0.6, sound: "pop" },
]

export function materialFor(worldIndex: number): Material {
  const zone = Math.floor(Math.max(0, worldIndex) / ZONE_SIZE)
  return MATERIALS[zone % MATERIALS.length]
}

/** 3D position of a keycap at an absolute (world) index along the spiral. */
export function positionFor(worldIndex: number): [number, number, number] {
  const a = worldIndex * ANGLE_STEP
  return [Math.cos(a) * RADIUS, worldIndex * RISE, Math.sin(a) * RADIUS]
}

/** Stereo/binaural pan hint (-1..1) from the spiral angle. */
export function panFor(worldIndex: number): number {
  return Math.cos(worldIndex * ANGLE_STEP)
}

// --- Musicality: a rising minor-pentatonic motif, so clean typing plays a melody ---
const BASE_FREQ = 196 // G3
const PENTATONIC = [0, 3, 5, 7, 10] // minor pentatonic semitone offsets
const OCTAVES = 2 // rise over two octaves, then loop

export function freqFor(worldIndex: number): number {
  const span = PENTATONIC.length * OCTAVES
  const step = ((worldIndex % span) + span) % span
  const octave = Math.floor(step / PENTATONIC.length)
  const semitone = PENTATONIC[step % PENTATONIC.length] + 12 * octave
  return BASE_FREQ * Math.pow(2, semitone / 12)
}
