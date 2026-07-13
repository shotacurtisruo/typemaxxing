import { useEffect, useReducer, useState } from "react"
import { useGame, wpm, accuracy, heightMeters } from "../game/store"
import { audio } from "../audio/AudioEngine"

export default function Hud() {
  const [, tick] = useReducer((n) => n + 1, 0)
  const [muted, setMuted] = useState(false)
  const flow = useGame((s) => s.flow)

  // Refresh time-based stats (WPM) even between keystrokes.
  useEffect(() => {
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [])

  const s = useGame.getState()

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    audio.setMuted(next)
  }

  return (
    <div className="hud">
      <div className="stats">
        <div className="stat">
          <span className="num">{wpm(s)}</span>
          <span className="unit">wpm</span>
        </div>
        <div className="stat">
          <span className="num">{accuracy(s)}%</span>
          <span className="unit">acc</span>
        </div>
        <div className="stat">
          <span className="num">{heightMeters(s)}m</span>
          <span className="unit">height</span>
        </div>
      </div>

      <div className="flow-wrap">
        <span className="flow-label">flow</span>
        <div className="flow-track">
          <div className="flow-fill" style={{ width: `${Math.round(flow * 100)}%` }} />
        </div>
      </div>

      <button className="mute" onClick={toggleMute} title="Mute / unmute">
        {muted ? "🔇" : "🔊"}
      </button>
    </div>
  )
}
