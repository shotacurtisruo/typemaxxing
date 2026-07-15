import { useEffect, useRef } from "react"
import { useGame } from "../game/store"

/** MonkeyType-style passage: correct = bright, wrong = red, caret, untyped = dim. */
export default function TypingBar() {
  const words = useGame((s) => s.words)
  const marks = useGame((s) => s.marks)
  const wi = useGame((s) => s.wi)
  const ci = useGame((s) => s.ci)
  const inner = useRef<HTMLDivElement>(null)
  const caret = useRef<HTMLSpanElement>(null)

  // Keep the caret line in view (measured after layout settles; clamped to the end).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const c = caret.current
      const el = inner.current
      const box = el?.parentElement
      if (!c || !el || !box) return
      const maxScroll = Math.max(0, el.scrollHeight - box.clientHeight)
      const offset = Math.min(Math.max(0, c.offsetTop), maxScroll)
      el.style.transform = `translateY(${-offset}px)`
    })
    return () => cancelAnimationFrame(raf)
  }, [wi, ci, words])

  return (
    <div className="passage">
      <div className="passage-inner" ref={inner}>
        {words.map((word, w) => (
          <span key={w} className="word">
            {word.split("").map((ch, i) => {
              const mark = marks[w]?.[i] ?? 0
              const isCaret = w === wi && i === ci
              const cls =
                mark === 1 ? "ch done" : mark === 2 ? "ch bad" : isCaret ? "ch current" : "ch todo"
              return (
                <span key={i} ref={isCaret ? caret : undefined} className={cls}>
                  {ch}
                </span>
              )
            })}
            {/* the space after the word carries the caret when the word is fully typed */}
            <span
              ref={w === wi && ci >= word.length ? caret : undefined}
              className={w === wi && ci >= word.length ? "ch current" : "ch todo"}
            >
              {" "}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
