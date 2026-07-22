import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
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

  const handleChar = useCallback((char: string) => {
    // Gameplay must never depend on Web Audio support or permission. Record the
    // key first, then treat sound as a best-effort enhancement.
    onStarted()
    const res = useGame.getState().press(char)
    if (!res) return
    try {
      audio.start()
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
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[typing] audio unavailable; continuing silently", err)
    }
  }, [onStarted])

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
    if (suppressed) {
      el.blur()
      return
    }

    // Focus immediately, then once more after dialog unmount cleanups have
    // restored focus to their opener. The deferred pass wins that cleanup race
    // and makes typing ready as soon as a modal closes.
    el.focus({ preventScroll: true })
    const frame = requestAnimationFrame(() => el.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppressed])

  // Last-resort keyboard recovery: if a browser leaves focus on the page or a
  // toolbar button, the first ordinary typing key focuses the gameplay input
  // and is still processed. Tab/Enter and Space on controls remain accessible.
  useEffect(() => {
    if (suppressed) return
    const el = inputRef.current
    if (!el) return
    const recover = (e: KeyboardEvent) => {
      if (document.activeElement === el || e.defaultPrevented || composing.current) return
      if (e.metaKey || e.ctrlKey || e.altKey || e.key === "Tab" || e.key === "Escape" || e.key === "Enter") return
      const active = document.activeElement as HTMLElement | null
      if (e.key === " " && active?.matches("button, a, input, select, textarea")) return

      if (e.key === "Backspace") {
        e.preventDefault()
        el.focus({ preventScroll: true })
        useGame.getState().backspace()
      } else if (e.key.length === 1) {
        e.preventDefault()
        el.focus({ preventScroll: true })
        handleChar(e.key)
      }
    }
    document.addEventListener("keydown", recover, true)
    return () => document.removeEventListener("keydown", recover, true)
  }, [handleChar, inputRef, suppressed])

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
