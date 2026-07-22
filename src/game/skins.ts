// Purchasable characters — each is a genuinely different critter with its own
// body and animation, all hand-drawn pixel animals (drawn on a canvas, then
// billboarded in the 3D scene). Prices are in coins, and coins are rare, so the
// fancier critters are a real climb to afford. The catalog is data-driven:
// adding a character is a new entry here, never new branching logic.

export type Species = "cat" | "fox" | "panda" | "bunny" | "frog" | "penguin"

export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic"

export interface CharacterDef {
  id: string
  name: string
  blurb: string
  price: number // coins; 0 = owned from the start
  species: Species // drives the pixel drawing
  fur: string // primary body color
  accent: string // scarf / beak / detail color
  belly: string // belly / cheeks
  patternColor: string // markings (stripes, patches, socks, tips)
  enabled?: boolean // false hides a WIP entry from the shop without deleting it (default true)
  isDefault?: boolean // the free starter; can never be locked or un-owned
  rarity?: Rarity
}

/** Back-compat alias — existing code imports `Skin`. */
export type Skin = CharacterDef

export const SKINS: CharacterDef[] = [
  { id: "cat", name: "Cat", blurb: "the original climber", price: 0, isDefault: true, rarity: "common", species: "cat", fur: "#e0561e", accent: "#5ff0d0", belly: "#fff3e6", patternColor: "#a83c12" },
  { id: "fox", name: "Fox", blurb: "bushy tail, dark socks", price: 40, rarity: "common", species: "fox", fur: "#e8702a", accent: "#7db4ff", belly: "#fbe7d2", patternColor: "#3a2418" },
  { id: "bunny", name: "Bunny", blurb: "hops up the tower", price: 70, rarity: "rare", species: "bunny", fur: "#eceef4", accent: "#ff9ec2", belly: "#ffffff", patternColor: "#d3aebb" },
  { id: "panda", name: "Panda", blurb: "roly-poly bamboo bud", price: 110, rarity: "rare", species: "panda", fur: "#f4f4f4", accent: "#8fd8b8", belly: "#ffffff", patternColor: "#20202a" },
  { id: "frog", name: "Frog", blurb: "leaps between steps", price: 160, rarity: "epic", species: "frog", fur: "#6cce49", accent: "#ffd23a", belly: "#e6f7c8", patternColor: "#3f8f2a" },
  { id: "penguin", name: "Penguin", blurb: "waddles ever upward", price: 240, rarity: "epic", species: "penguin", fur: "#2b2f38", accent: "#ff8a2c", belly: "#f4f6fb", patternColor: "#12141a" },
]

export const DEFAULT_SKIN = "cat"

/** Cost of one gacha crank, in coins. */
export const PULL_COST = 50

/** Relative pull odds by rarity — commons are common, legendaries are a dream.
 *  Weights are normalized across whatever rarities are actually in the pool. */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 28, epic: 9, legendary: 2.5, mythic: 0.5 }

/** Coins refunded when a crank lands a duplicate (only once the set is complete).
 *  Always below PULL_COST for commons — dupes are a consolation, not income. */
export const DUPE_REFUND: Record<Rarity, number> = { common: 15, rare: 25, epic: 40, legendary: 65, mythic: 100 }

export function skinById(id: string): CharacterDef {
  return SKINS.find((s) => s.id === id) ?? SKINS[0]
}

/** Catalog entries that should appear in the collection / be equippable. */
export function catalog(): CharacterDef[] {
  return SKINS.filter((s) => s.enabled !== false)
}

/** Animals obtainable from the gacha (everything buyable — excludes the free starter). */
export function gachaPool(): CharacterDef[] {
  return catalog().filter((s) => !s.isDefault)
}
