import { useEffect, useState } from "react"
import Scene from "./three/Scene"
import Gallery from "./three/Gallery"
import KeycapGallery from "./three/KeycapGallery"
import DesignLab from "./three/DesignLab"
import TypingBar from "./ui/TypingBar"
import Hud from "./ui/Hud"
import { useGame } from "./game/store"
import { audio } from "./audio/AudioEngine"
import { panForWord } from "./game/config"

export default function App() {
  const [started, setStarted] = useState(false)
  const weather = useGame((s) => s.weather)

  // Showcases: /?gallery (all objects) · /?keycaps (keycap profiles)
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const isGallery = params.has("gallery")
  const isKeycaps = params.has("keycaps")
  const isDesign = params.has("design")

  // Keep the ambience bed in sync with the current weather.
  useEffect(() => {
    audio.setAmbience(weather.name)
  }, [weather.name])

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
      if (!started) {
        setStarted(true)
        audio.setAmbience(useGame.getState().weather.name)
      }

      const res = useGame.getState().press(e.key)
      if (!res) return
      const pan = panForWord(res.worldIndex)
      if (res.correct) {
        const pitch = res.worldIndex * 4 + res.slot // rising pentatonic across the climb
        if (res.object.shape === "keycap") {
          audio.playKeycap(useGame.getState().keycap, pitch, pan, res.flow)
        } else {
          audio.playKey(pitch, pan, res.object.sound, res.object.impact, res.flow)
        }
      } else {
        audio.playDud(pan)
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [started])

  if (isDesign) return <DesignLab />
  if (isKeycaps) return <KeycapGallery />
  if (isGallery) return <Gallery />

  return (
    <div className="app">
      <div
        className="scene"
        style={{
          backgroundImage: `linear-gradient(180deg, ${weather.sky[0]} 0%, ${weather.sky[1]} 45%, ${weather.sky[2]} 100%)`,
        }}
      >
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
