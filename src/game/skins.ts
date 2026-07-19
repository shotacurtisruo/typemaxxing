// Purchasable characters — each is a genuinely different animal with its own
// pixel body and animation (not a recolored cat). Prices are in coins, and
// coins are rare, so the fancier critters are a real climb to afford.

export type Species = "cat" | "fox" | "panda" | "bunny" | "frog" | "penguin"

export interface Skin {
  id: string
  name: string
  blurb: string
  price: number // coins; 0 = owned from the start
  species: Species
  fur: string // primary body color
  accent: string // scarf / beak / detail color
  belly: string // belly / cheeks
  patternColor: string // markings (stripes, patches, socks, tips)
}

export const SKINS: Skin[] = [
  { id: "cat", name: "Cat", blurb: "the original climber", price: 0, species: "cat", fur: "#e0561e", accent: "#5ff0d0", belly: "#fff3e6", patternColor: "#a83c12" },
  { id: "fox", name: "Fox", blurb: "bushy tail, dark socks", price: 40, species: "fox", fur: "#e8702a", accent: "#7db4ff", belly: "#fbe7d2", patternColor: "#3a2418" },
  { id: "bunny", name: "Bunny", blurb: "hops up the tower", price: 70, species: "bunny", fur: "#eceef4", accent: "#ff9ec2", belly: "#ffffff", patternColor: "#d3aebb" },
  { id: "panda", name: "Panda", blurb: "roly-poly bamboo bud", price: 110, species: "panda", fur: "#f4f4f4", accent: "#8fd8b8", belly: "#ffffff", patternColor: "#20202a" },
  { id: "frog", name: "Frog", blurb: "leaps between steps", price: 160, species: "frog", fur: "#6cce49", accent: "#ffd23a", belly: "#e6f7c8", patternColor: "#3f8f2a" },
  { id: "penguin", name: "Penguin", blurb: "waddles ever upward", price: 240, species: "penguin", fur: "#2b2f38", accent: "#ff8a2c", belly: "#f4f6fb", patternColor: "#12141a" },
]

export const DEFAULT_SKIN = "cat"

export function skinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0]
}
