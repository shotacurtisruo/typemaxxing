import { describe, it, expect, beforeEach } from "vitest"
import { loadState, saveState, updateSettings, pushHistory, _resetCache, DEFAULT_SETTINGS } from "./persist"

beforeEach(() => {
  localStorage.clear()
  _resetCache()
})

describe("persist — versioned storage + migration", () => {
  it("returns defaults on a clean install", () => {
    const s = loadState()
    expect(s.coins).toBe(0)
    expect(s.ownedSkins).toEqual(["cat"])
    expect(s.mode).toBe("zen")
    expect(s.settings).toEqual(DEFAULT_SETTINGS)
    expect(s.tutorialSeen).toBe(false)
  })

  it("migrates legacy thock-* keys non-destructively", () => {
    localStorage.setItem("thock-coins", "137")
    localStorage.setItem("thock-owned-v1", JSON.stringify(["cat", "fox", "panda"]))
    localStorage.setItem("thock-char-v2", JSON.stringify({ skin: "fox", fur: "#abc", accent: "#def" }))
    localStorage.setItem("thock-mode", "30")
    _resetCache()

    const s = loadState()
    expect(s.coins).toBe(137)
    expect(s.ownedSkins).toEqual(["cat", "fox", "panda"])
    expect(s.character.skin).toBe("fox")
    expect(s.mode).toBe(30)
    // v1 blob is now written…
    expect(localStorage.getItem("typemaxxing:v1")).toBeTruthy()
    // …and the legacy keys are left intact (non-destructive)
    expect(localStorage.getItem("thock-coins")).toBe("137")
  })

  it("prefers the v1 blob over legacy once migrated", () => {
    saveState({ coins: 500 })
    localStorage.setItem("thock-coins", "1") // stale legacy value must be ignored
    _resetCache()
    expect(loadState().coins).toBe(500)
  })

  it("persists settings and merges unknown/missing fields with defaults", () => {
    updateSettings({ muted: true, masterVolume: 0.3 })
    _resetCache()
    const s = loadState()
    expect(s.settings.muted).toBe(true)
    expect(s.settings.masterVolume).toBe(0.3)
    expect(s.settings.quality).toBe(DEFAULT_SETTINGS.quality) // untouched default preserved
  })

  it("bounds run history growth", () => {
    for (let i = 0; i < 80; i++) pushHistory({ at: i, mode: "zen", wpm: i, raw: i, acc: 100, height: i })
    expect(loadState().history.length).toBeLessThanOrEqual(50)
    // keeps the most recent
    expect(loadState().history.at(-1)?.wpm).toBe(79)
  })
})
