import { useEffect, useRef, useState, type RefObject } from "react"
import { useGame } from "../game/store"
import { audio } from "../audio/AudioEngine"
import { panForWord } from "../game/config"

/**
 * Focus-managed gameplay input. A visually-hidden <textarea> is the ONLY surface
 * that consumes typing — nothing is read off `window`, so keys never leak behind
 * a dialog. IME/composition is handled so non-US layouts and dead keys work, and
 * we only preventDefault the keys we actually consume (Tab is never hijacked).
 */
export default function TypingInput({
  inputRef,
  suppressed,
  onStarted,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>
  suppressed: boolean
  onStarted: () => void
}) {
  const composing = useRef(false)
  const [focused, setFocused] = useState(false)

  const handleChar = (char: string) => {
    audio.start()
    onStarted()
    const res = useGame.getState().press(char)
    if (!res) return
    const gs = useGame.getState()
    const pan = panForWord(gs.angles[gs.wi] ?? 0)
    if (res.slip) {
      audio.playSlip(pan)
    } else if (res.kind === "correct" || res.kind === "jump") {
      const pitch = res.worldIndex * 4 + res.slot
      if (res.object.shape === "keycap") audio.playKeycap(gs.keycap, pitch, pan, res.flow)
      else audio.playKey(pitch, pan, res.object.sound, res.object.impact, res.flow)
    } else if (res.kind === "error") {
      audio.playDud(pan)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suppressed || composing.current) return // never process gameplay behind a dialog
    if (e.altKey && (e.key === "n" || e.key === "N")) {
      e.preventDefault()
      useGame.getState().newRun()
      return
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === "Tab") return // never hijack Tab
    if (e.key === "Escape") {
      e.preventDefault()
      e.currentTarget.blur() // soft-pause: unfocus, don't destroy the run
      return
    }
    if (e.key === "Backspace") {
      e.preventDefault()
      useGame.getState().backspace()
      return
    }
    if (e.key === "Enter") return
    if (e.key.length === 1) {
      e.preventDefault()
      handleChar(e.key)
    }
  }

  const onInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    if (suppressed || composing.current) return
    const el = e.currentTarget
    if (el.value) {
      for (const ch of el.value) if (ch !== "\n") handleChar(ch)
      el.value = ""
    }
  }

  const onCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    composing.current = false
    e.currentTarget.value = ""
    if (suppressed) return
    for (const ch of e.data ?? "") handleChar(ch)
  }

  // dialogs blur the input so keys can't reach gameplay; restore focus after
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    if (suppressed) el.blur()
    else el.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppressed])

  return (
    <>
      <textarea
        ref={inputRef}
        className="type-input"
        aria-label="Typing input — type the passage to climb"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onKeyDown={onKeyDown}
        onInput={onInput}
        onCompositionStart={() => (composing.current = true)}
        onCompositionEnd={onCompositionEnd}
        onFocus={() => {
          setFocused(true)
          useGame.getState().resumeClock()
        }}
        onBlur={() => {
          setFocused(false)
          useGame.getState().pauseClock()
        }}
      />
      {!focused && !suppressed && (
        <button className="type-resume" onClick={() => inputRef.current?.focus()}>
          click to resume typing
        </button>
      )}
    </>
  )
}
