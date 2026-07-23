import { describe, it, expect } from "vitest"
import { qualityFromTier, downgrade } from "./quality"

describe("quality — tiers", () => {
  it("low materially cuts rendering cost vs high", () => {
    const low = qualityFromTier("low")
    const high = qualityFromTier("high")
    expect(low.dpr).toBeLessThan(high.dpr)
    expect(low.shadows).toBe(false)
    expect(high.shadows).toBe(true)
    expect(low.particleScale).toBeLessThan(high.particleScale)
  })

  it("dpr is capped within 1..2 per tier", () => {
    for (const t of ["low", "medium", "high"] as const) {
      const q = qualityFromTier(t)
      expect(q.dpr).toBeGreaterThanOrEqual(1)
      expect(q.dpr).toBeLessThanOrEqual(2)
    }
  })

  it("downgrade steps high → medium → low and latches at low", () => {
    expect(downgrade("high")).toBe("medium")
    expect(downgrade("medium")).toBe("low")
    expect(downgrade("low")).toBe("low")
  })
})
