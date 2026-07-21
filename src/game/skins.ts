// Purchasable characters — each is a genuinely different critter with its own
// body and animation. Two render KINDS coexist as first-class, separately
// buyable characters:
//   - "sprite": the hand-drawn pixel animals (drawn on a canvas, billboarded)
//   - "model":  a 3D GLB loaded at runtime (added in later phases)
// Prices are in coins, and coins are rare, so the fancier critters are a real
// climb to afford. The catalog is data-driven: adding a character is a new entry
// here, never new branching logic.

export type Species = "cat" | "fox" | "panda" | "bunny" | "frog" | "penguin"

/** How a character is rendered. Defaults to "sprite" (the original pixel path). */
export type RenderKind = "sprite" | "model"

export type Rarity = "common" | "rare" | "epic" | "legendary"

/** Logical animation states the character controller can request. The controller
 *  never names GLB clips directly — it emits one of these and the catalog's
 *  `model.clips` map resolves it (with fallbacks) to an actual clip name. */
export type AnimState = "idle" | "walk" | "run" | "climb" | "jump" | "fall" | "land" | "defeat"

/** 3D model metadata — present only when `kind === "model"`. */
export interface ModelSpec {
  path: string // GLB under /public, lazy-loaded e.g. "/models/robo.glb"
  thumb?: string // optional pre-rendered shop thumbnail; else a pixel preview is used
  scale: number // uniform scale to reach ~1 world-unit height
  offset: [number, number, number] // fine position nudge (origin should be at feet)
  rotation: [number, number, number] // correct authored forward to the +Z convention
  clips: Partial<Record<AnimState, string>> // logical state -> clip name in the GLB
}

export interface CharacterDef {
  id: string
  name: string
  blurb: string
  price: number // coins; 0 = owned from the start
  kind: RenderKind // "sprite" (pixel) or "model" (3D GLB)
  species: Species // drives the pixel drawing; also a loose visual family for models
  fur: string // primary body color
  accent: string // scarf / beak / detail color
  belly: string // belly / cheeks
  patternColor: string // markings (stripes, patches, socks, tips)
  enabled?: boolean // false hides a WIP entry from the shop without deleting it (default true)
  isDefault?: boolean // the free starter; can never be locked or un-owned
  rarity?: Rarity
  model?: ModelSpec // required iff kind === "model"
}

/** Back-compat alias — existing code imports `Skin`. */
export type Skin = CharacterDef

export const SKINS: CharacterDef[] = [
  { id: "cat", name: "Cat", blurb: "the original climber", price: 0, kind: "sprite", isDefault: true, rarity: "common", species: "cat", fur: "#e0561e", accent: "#5ff0d0", belly: "#fff3e6", patternColor: "#a83c12" },
  { id: "fox", name: "Fox", blurb: "bushy tail, dark socks", price: 40, kind: "sprite", rarity: "common", species: "fox", fur: "#e8702a", accent: "#7db4ff", belly: "#fbe7d2", patternColor: "#3a2418" },
  { id: "bunny", name: "Bunny", blurb: "hops up the tower", price: 70, kind: "sprite", rarity: "rare", species: "bunny", fur: "#eceef4", accent: "#ff9ec2", belly: "#ffffff", patternColor: "#d3aebb" },
  { id: "panda", name: "Panda", blurb: "roly-poly bamboo bud", price: 110, kind: "sprite", rarity: "rare", species: "panda", fur: "#f4f4f4", accent: "#8fd8b8", belly: "#ffffff", patternColor: "#20202a" },
  { id: "frog", name: "Frog", blurb: "leaps between steps", price: 160, kind: "sprite", rarity: "epic", species: "frog", fur: "#6cce49", accent: "#ffd23a", belly: "#e6f7c8", patternColor: "#3f8f2a" },
  { id: "penguin", name: "Penguin", blurb: "waddles ever upward", price: 240, kind: "sprite", rarity: "epic", species: "penguin", fur: "#2b2f38", accent: "#ff8a2c", belly: "#f4f6fb", patternColor: "#12141a" },
  // ⚠️ TEMPORARY PLACEHOLDER 3D CHARACTER — exercises the full model pipeline
  // until a bespoke Meshy character replaces it. See docs/characters/PLACEHOLDER_ASSET.md
  // for the exact swap procedure. Model: three.js "RobotExpressive" by Tomás
  // Laulhé, modified by Don McCurdy — CC0 (public/models/robot.glb, ~0.44 MB).
  // Low price so unlocking is easy to test. Sprite fields below are the pixel
  // fallback shown if the GLB ever fails to load (a grey recolored cat).
  {
    id: "robot",
    name: "Robot",
    blurb: "3D test character",
    price: 5, // temporary low unlock price for easy testing
    kind: "model",
    rarity: "rare",
    species: "cat", // sprite-fallback body if the GLB fails to load
    fur: "#9aa1ab",
    accent: "#5ff0d0",
    belly: "#e9ecf2",
    patternColor: "#4a4f5a",
    model: {
      path: "/models/robot.glb",
      scale: 0.42,
      offset: [0, 0, 0],
      // −90° yaw: turns the model to a side profile so it faces the travel
      // direction (like the sprite) instead of facing the camera. Applied to the
      // visual primitive only; the group still billboard-yaws + flips by facing.
      rotation: [0, -Math.PI / 2, 0],
      // RobotExpressive's actual clip names, mapped to our logical states.
      // Missing states resolve via useCharacterModel's FALLBACK chain → idle.
      clips: {
        idle: "Idle",
        walk: "Walking",
        run: "Running", // fast movement (≥45 wpm)
        climb: "Walking",
        jump: "Jump",
        fall: "Jump", // no dedicated fall clip; Jump reads as airborne
        land: "Idle",
        defeat: "Death", // game-over / fall-defeat reaction
      },
    },
  },
  // 3D character. Model: "Shiba Inu" by Quaternius (Animated Animal Pack) — CC0.
  // Source: https://poly.pizza/m/y4wdQpg767. Pixel fields = fox-shaped fallback
  // if the GLB fails to load.
  {
    id: "shiba",
    name: "Shiba",
    blurb: "fully 3D — bounds up the tower",
    price: 50,
    kind: "model",
    rarity: "rare",
    species: "fox",
    fur: "#e0a860",
    accent: "#e05050",
    belly: "#fbe7d2",
    patternColor: "#8a5a2a",
    model: {
      path: "/models/shiba.glb",
      scale: 0.9,
      offset: [0, 0, 0],
      rotation: [0, -Math.PI / 2, 0], // +Z-forward default → side profile
      clips: {
        idle: "Idle",
        walk: "Walk",
        run: "Gallop", // fast movement (≥45 wpm)
        climb: "Walk",
        jump: "Gallop_Jump",
        fall: "Gallop_Jump", // airborne
        land: "Jump_ToIdle", // landing recovery
        defeat: "Death",
      },
    },
  },
]

export const DEFAULT_SKIN = "cat"

export function skinById(id: string): CharacterDef {
  return SKINS.find((s) => s.id === id) ?? SKINS[0]
}

/** Catalog entries that should appear in the shop / be equippable. */
export function catalog(): CharacterDef[] {
  return SKINS.filter((s) => s.enabled !== false)
}

/** True when the entry is a buyable/equippable 3D model with a valid spec. */
export function isModel(def: CharacterDef): def is CharacterDef & { model: ModelSpec } {
  return def.kind === "model" && !!def.model
}
