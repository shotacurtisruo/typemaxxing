import { describe, it, expect } from "vitest"
import { EMPTY_STATS, accuracy, rawWpm, netWpm, uncorrectedErrors, snapshot, type Stats } from "./stats"

const mk = (p: Partial<Stats>): Stats => ({ ...EMPTY_STATS, ...p })

describe("stats — pure functions", () => {
  it("empty run reads as 100% accuracy and 0 wpm", () => {
    expect(accuracy(EMPTY_STATS)).toBe(100)
    expect(rawWpm(EMPTY_STATS, 1)).toBe(0)
    expect(netWpm(EMPTY_STATS, 1)).toBe(0)
  })

  it("net wpm counts only correct chars; raw counts correct + incorrect", () => {
    const s = mk({ correctTyped: 50, incorrectTyped: 10 })
    // over 1 minute: net = 50/5 = 10, raw = 60/5 = 12
    expect(netWpm(s, 1)).toBe(10)
    expect(rawWpm(s, 1)).toBe(12)
  })

  it("accuracy = correct / (correct + incorrect + missed), rounded", () => {
    expect(accuracy(mk({ correctTyped: 90, incorrectTyped: 10 }))).toBe(90)
    expect(accuracy(mk({ correctTyped: 8, incorrectTyped: 1, missedCharacters: 1 }))).toBe(80)
  })

  it("accuracy is clamped to 0..100 and never negative when space is pressed early", () => {
    // lots of missed characters, nothing correct
    expect(accuracy(mk({ correctTyped: 0, incorrectTyped: 0, missedCharacters: 40 }))).toBe(0)
    expect(accuracy(mk({ correctTyped: 5, missedCharacters: 100 }))).toBeGreaterThanOrEqual(0)
    expect(accuracy(mk({ correctTyped: 5, missedCharacters: 100 }))).toBeLessThanOrEqual(100)
    // perfect run stays exactly 100
    expect(accuracy(mk({ correctTyped: 100 }))).toBe(100)
  })

  it("uncorrected errors = incorrect - corrected, never negative", () => {
    expect(uncorrectedErrors(mk({ incorrectTyped: 5, correctedErrors: 2 }))).toBe(3)
    expect(uncorrectedErrors(mk({ incorrectTyped: 2, correctedErrors: 9 }))).toBe(0)
  })

  it("zero/negative minutes never divide-by-zero", () => {
    const s = mk({ correctTyped: 10 })
    expect(rawWpm(s, 0)).toBe(0)
    expect(netWpm(s, -1)).toBe(0)
  })

  it("snapshot exposes all display fields", () => {
    const snap = snapshot(mk({ correctTyped: 25, incorrectTyped: 5, correctedErrors: 2, missedCharacters: 3 }), 1)
    expect(snap.wpm).toBe(5)
    expect(snap.raw).toBe(6)
    expect(snap.acc).toBe(Math.round((25 / 33) * 100))
    expect(snap.uncorrectedErrors).toBe(3)
    expect(snap.missedCharacters).toBe(3)
  })
})
