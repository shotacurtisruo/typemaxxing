import { useEffect, useReducer } from "react"
import { useGame, wpm, accuracy, heightMeters, checkpointProgress, type GameMode } from "../game/store"

const MODES: GameMode[] = ["zen", 15, 30, 60, 120]

function MuteIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
      {muted ? (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  )
}

export default function Hud() {
  const [, tick] = useReducer((n) => n + 1, 0)
  const flow = useGame((s) => s.flow)
  const keycap = useGame((s) => s.keycap)
  const toggleKeycap = useGame((s) => s.toggleKeycap)
  const mode = useGame((s) => s.mode)
  const setMode = useGame((s) => s.setMode)
  const settings = useGame((s) => s.settings)
  const setSettings = useGame((s) => s.setSettings)
  const phase = useGame((s) => s.phase)
  const finishSession = useGame((s) => s.finishSession)

  useEffect(() => {
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [])

  const s = useGame.getState()
  const timeLeft =
    mode === "zen" || !s.startTime || s.phase !== "running"
      ? mode === "zen"
        ? null
        : (mode as number)
      : Math.max(0, Math.ceil((mode as number) - ((s.pausedAt ?? Date.now()) - s.startTime) / 1000))

  const cp = checkpointProgress(s)

  return (
    <div className="hud">
      <div className="stats">
        {timeLeft !== null && (
          <div className="stat">
            <span className="num">{timeLeft}</span>
            <span className="unit">time</span>
          </div>
        )}
        {settings.showWpm && (
          <div className="stat">
            <span className="num">{wpm(s)}</span>
            <span className="unit">wpm</span>
          </div>
        )}
        {settings.showAcc && (
          <div className="stat">
            <span className="num">{accuracy(s)}%</span>
            <span className="unit">acc</span>
          </div>
        )}
        {settings.showHeight && (
          <div className="stat">
            <span className="num">{heightMeters(s)}m</span>
            <span className="unit">height</span>
          </div>
        )}
      </div>

      <div className="modes">
        {MODES.map((m) => (
          <button
            key={String(m)}
            className={`mode-pill ${mode === m ? "on" : ""}`}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            title={m === "zen" ? "Endless zen climb" : `${m}-second sprint`}
          >
            {m === "zen" ? "zen" : `${m}s`}
          </button>
        ))}
      </div>

      {settings.showFlow && (
        <div className="flow-wrap">
          <span className="flow-label">flow</span>
          <div className="flow-track">
            <div className="flow-fill" style={{ width: `${Math.round(flow * 100)}%` }} />
            <div className="flow-checkpoint" style={{ left: `${Math.round(cp.frac * 100)}%` }} title={`next checkpoint in ${cp.nextIn} words`} />
          </div>
        </div>
      )}

      {mode === "zen" && phase === "running" && (
        <button className="hud-btn tactile" onClick={finishSession} title="End this Zen session and see results">
          finish
        </button>
      )}

      <button className="cap-toggle tactile" onClick={toggleKeycap} title="Switch keycap + tone">
        cap: <b>{keycap.toUpperCase()}</b> {keycap === "mt3" ? "· thocky" : "· creamy"}
      </button>
      <button
        className="mute tactile"
        onClick={() => setSettings({ muted: !settings.muted })}
        aria-label={settings.muted ? "Unmute" : "Mute"}
        aria-pressed={settings.muted}
        title={settings.muted ? "Unmute" : "Mute"}
      >
        <MuteIcon muted={settings.muted} />
      </button>
    </div>
  )
}
