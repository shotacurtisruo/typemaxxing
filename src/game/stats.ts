// Explicit, MonkeyType-aligned typing statistics — pure functions only, so they
// can be unit-tested in isolation from the store, the clock, and the DOM.
//
// Conventions (documented so the results screen and tests agree):
//  - correctTyped / incorrectTyped count *character* keypresses (letters). A
//    wrong letter counts once toward incorrectTyped even if later fixed.
//  - correctedErrors counts wrong letters that were removed with Backspace.
//  - missedCharacters counts letters skipped by pressing Space before the word
//    was finished. Missed letters are never *typed*, so they do NOT add to raw
//    WPM and do NOT count as correct for net WPM — they only lower accuracy.
//  - extraCharacters counts letters typed past a word's end (reserved; the
//    current input never produces overflow, so it stays 0).
//  - physicalKeystrokes counts every key that did something (letters, space,
//    backspace) — the truest "keys pressed" figure.

export interface Stats {
  correctTyped: number
  incorrectTyped: number
  correctedErrors: number
  missedCharacters: number
  extraCharacters: number
  physicalKeystrokes: number
}

export const EMPTY_STATS: Stats = {
  correctTyped: 0,
  incorrectTyped: 0,
  correctedErrors: 0,
  missedCharacters: 0,
  extraCharacters: 0,
  physicalKeystrokes: 0,
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Errors still standing (typed wrong and never corrected). Never negative. */
export function uncorrectedErrors(s: Stats): number {
  return Math.max(0, s.incorrectTyped - s.correctedErrors)
}

/** Raw WPM: every character actually typed (right or wrong), 5 chars = 1 word. */
export function rawWpm(s: Stats, minutes: number): number {
  if (minutes <= 0) return 0
  return Math.max(0, Math.round((s.correctTyped + s.incorrectTyped) / 5 / minutes))
}

/** Net WPM: only correct characters count. */
export function netWpm(s: Stats, minutes: number): number {
  if (minutes <= 0) return 0
  return Math.max(0, Math.round(s.correctTyped / 5 / minutes))
}

/**
 * Accuracy as an integer 0–100. Denominator includes missed characters so that
 * pressing Space early is penalized, and is clamped so it can never be negative
 * or exceed 100. An empty run reads as 100 (nothing typed wrong yet).
 */
export function accuracy(s: Stats): number {
  const denom = s.correctTyped + s.incorrectTyped + s.missedCharacters
  if (denom <= 0) return 100
  return clamp(Math.round((s.correctTyped / denom) * 100), 0, 100)
}

export interface RunSnapshot {
  wpm: number // net
  raw: number
  acc: number
  correctTyped: number
  incorrectTyped: number
  correctedErrors: number
  uncorrectedErrors: number
  missedCharacters: number
  physicalKeystrokes: number
}

/** Freeze a run into a comparable, display-ready snapshot. */
export function snapshot(s: Stats, minutes: number): RunSnapshot {
  return {
    wpm: netWpm(s, minutes),
    raw: rawWpm(s, minutes),
    acc: accuracy(s),
    correctTyped: s.correctTyped,
    incorrectTyped: s.incorrectTyped,
    correctedErrors: s.correctedErrors,
    uncorrectedErrors: uncorrectedErrors(s),
    missedCharacters: s.missedCharacters,
    physicalKeystrokes: s.physicalKeystrokes,
  }
}
