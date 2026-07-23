// Central performance + motion policy. Quality is implicit: "auto" derives a tier
// from device capability and a runtime frame-time governor may downgrade it;
// an explicit tier (if ever set in settings) is honored as-is. Reduced motion is
// the OS `prefers-reduced-motion` OR the stored setting — no dedicated UI.

export type Tier = "low" | "medium" | "high"

export interface QualityLevel {
  dpr: number // max device-pixel-ratio cap
  shadows: boolean
  particleScale: number // 0..1 multiplier on weather particle counts
}

const LEVELS: Record<Tier, QualityLevel> = {
  low: { dpr: 1, shadows: false, particleScale: 0.35 },
  medium: { dpr: 1.5, shadows: true, particleScale: 0.7 },
  high: { dpr: 2, shadows: true, particleScale: 1 },
}

/** Pure: resolve a tier to concrete render knobs. */
export function qualityFromTier(tier: Tier): QualityLevel {
  return LEVELS[tier]
}

/** Pure: one step down the quality ladder (latched at "low"). */
export function downgrade(tier: Tier): Tier {
  return tier === "high" ? "medium" : "low"
}

/** Best-effort device tier from cores / memory / mobile / pixel ratio. */
export function detectTier(): Tier {
  if (typeof navigator === "undefined") return "high"
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  if (cores <= 2 || mem <= 2) return "low"
  if (mobile || cores <= 4 || mem <= 4) return "medium"
  return "high"
}

/** Live-read motion policy for useFrame code (camera shake, squash), updated by
 *  a React effect. Mutable singleton, same pattern as sceneBus. */
export const motion = { reduced: false }

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}
