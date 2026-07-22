import { useState } from "react"
import { useGame } from "../game/store"
import Dialog from "./Dialog"

export default function Results() {
  const results = useGame((s) => s.results)
  const retryRun = useGame((s) => s.retryRun)
  const newRun = useGame((s) => s.newRun)
  const [copied, setCopied] = useState(false)
  if (!results) return null

  const modeLabel = results.mode === "zen" ? "zen" : `${results.mode}s`

  const summary =
    `Typemaxxing — ${results.wpm} wpm · ${results.acc}% acc · ${results.height}m\n` +
    `${modeLabel} · raw ${results.raw} · streak ${results.bestStreak} · ${results.checkpoints} checkpoints`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <Dialog title="Run results" onClose={newRun} className="res-panel" labelId="res-title">
      <div
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            retryRun()
          }
        }}
      >
        <div className="res-titlebar">
          <span id="res-title" className="res-mode">{modeLabel}</span>
          {results.isPb ? (
            <span className="res-pb best">★ new personal best</span>
          ) : results.pbDelta !== 0 ? (
            <span className="res-pb">{results.pbDelta > 0 ? "+" : ""}{results.pbDelta} wpm vs best</span>
          ) : null}
        </div>

        <div className="res-big">
          <div className="res-metric">
            <span className="res-num">{results.wpm}</span>
            <span className="res-label">wpm</span>
          </div>
          <div className="res-metric">
            <span className="res-num">{results.acc}%</span>
            <span className="res-label">acc</span>
          </div>
        </div>

        <div className="res-grid">
          <div className="res-cell"><span className="res-cell-num">{results.raw}</span><span className="res-cell-label">raw</span></div>
          <div className="res-cell">
            <span className="res-cell-num">
              {results.correctTyped}
              <span className="res-dim">/</span>
              <span className="res-red">{results.incorrectTyped}</span>
            </span>
            <span className="res-cell-label">correct / wrong</span>
          </div>
          <div className="res-cell"><span className="res-cell-num">{results.correctedErrors}</span><span className="res-cell-label">corrected</span></div>
          <div className="res-cell"><span className="res-cell-num">{results.missedCharacters}</span><span className="res-cell-label">missed</span></div>
          <div className="res-cell"><span className="res-cell-num">{results.height}m</span><span className="res-cell-label">height</span></div>
          <div className="res-cell"><span className="res-cell-num">{results.bestStreak}</span><span className="res-cell-label">best streak</span></div>
          <div className="res-cell"><span className="res-cell-num">{results.checkpoints}</span><span className="res-cell-label">checkpoints</span></div>
          <div className="res-cell"><span className="res-cell-num">+{results.coins}</span><span className="res-cell-label">coins</span></div>
        </div>

        <div className="res-actions">
          <button className="res-again primary" onClick={retryRun}>retry <span className="res-kbd">↵</span></button>
          <button className="res-again" onClick={newRun}>new climb</button>
          <button className="res-again ghost" onClick={copy}>{copied ? "copied ✓" : "copy"}</button>
        </div>
        <div className="res-hint">enter · retry · esc · new climb</div>
      </div>
    </Dialog>
  )
}
