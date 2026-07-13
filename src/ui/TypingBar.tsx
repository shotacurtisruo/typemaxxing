import { useGame } from "../game/store"

/** MonkeyType-style passage display: typed (bright), caret, untyped (dim). */
export default function TypingBar() {
  const passage = useGame((s) => s.passage)
  const typed = useGame((s) => s.typed)

  return (
    <div className="passage">
      {passage.split("").map((ch, i) => {
        const state = i < typed ? "done" : i === typed ? "current" : "todo"
        return (
          <span key={i} className={`ch ${state}`}>
            {ch === " " ? " " : ch}
          </span>
        )
      })}
    </div>
  )
}
