import { useEffect, useState } from "react"
import Scene from "./three/Scene"
import TypingBar from "./ui/TypingBar"
import Hud from "./ui/Hud"
import { useGame } from "./game/store"
import { audio } from "./audio/AudioEngine"
import { panFor } from "./game/config"

export default function App() {
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === "Escape") {
        useGame.getState().reset()
        return
      }
      if (e.key === "Tab") {
        e.preventDefault()
        useGame.getState().reset()
        return
      }
      // only printable single characters (includes space)
      if (e.key.length !== 1) return
      e.preventDefault()

      audio.start() // first user gesture unlocks Web Audio
      if (!started) setStarted(true)

      const res = useGame.getState().press(e.key)
      if (!res) return
      if (res.correct) {
        audio.playKey(res.worldIndex, res.material.sound, res.flow)
      } else {
        audio.playDud(panFor(res.worldIndex))
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [started])

  return (
    <div className="app">
      <div className="scene">
        <Scene />
        <div className="brand">thock</div>
        {!started && (
          <div className="hint">
            <p>start typing to climb</p>
            <p className="sub">🎧 headphones recommended · esc restart · tab new passage</p>
          </div>
        )}
      </div>
      <div className="panel">
        <Hud />
        <TypingBar />
      </div>
    </div>
  )
}
