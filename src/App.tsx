import { useEffect, useRef, useState } from "react"
import Scene from "./three/Scene"
import Gallery from "./three/Gallery"
import KeycapGallery from "./three/KeycapGallery"
import DesignLab from "./three/DesignLab"
import TypingBar from "./ui/TypingBar"
import Hud from "./ui/Hud"
import Customizer from "./ui/Customizer"
import Results from "./ui/Results"
import { AuthButtons } from "./auth/Auth"
import { useGame } from "./game/store"
import { audio } from "./audio/AudioEngine"
import { panForWord, hexLerp } from "./game/config"

export default function App() {
  const [started, setStarted] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const weather = useGame((s) => s.weather)
  const coins = useGame((s) => s.coins)
  const sceneRef = useRef<HTMLDivElement>(null)

  // Smoothly crossfade the sky gradient toward the current weather.
  useEffect(() => {
    let raf = 0
    const cur: [string, string, string] = [...useGame.getState().weather.sky]
    const tick = () => {
      const target = useGame.getState().weather.sky
      for (let i = 0; i < 3; i++) cur[i] = hexLerp(cur[i], target[i], 0.05)
      if (sceneRef.current) {
        sceneRef.current.style.backgroundImage = `linear-gradient(180deg, ${cur[0]} 0%, ${cur[1]} 45%, ${cur[2]} 100%)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Showcases: /?gallery (all objects) · /?keycaps (keycap profiles)
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const isGallery = params.has("gallery")
  const isKeycaps = params.has("keycaps")
  const isDesign = params.has("design")

  // Keep the ambience bed in sync with the current weather.
  useEffect(() => {
    audio.setAmbience(weather.name)
  }, [weather.name])

  // Load any CC0 material samples (falls back to synth for missing ones).
  useEffect(() => {
    void audio.loadManifest()
  }, [])

  // Timed modes: end the run when the clock hits zero.
  useEffect(() => {
    const id = setInterval(() => {
      const st = useGame.getState()
      if (
        st.phase === "running" &&
        st.mode !== "zen" &&
        st.startTime &&
        Date.now() - st.startTime >= (st.mode as number) * 1000
      ) {
        st.endRun()
      }
    }, 150)
    return () => clearInterval(id)
  }, [])
  const phase = useGame((s) => s.phase)

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
      if (e.key === "Backspace") {
        e.preventDefault()
        useGame.getState().backspace()
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
      const gs = useGame.getState()
      const pan = panForWord(gs.angles[gs.wi] ?? 0)
      // coins are grabbed by the cat physically passing them (see Coin.tsx),
      // not on keystroke — so they only vanish as you go by.
      if (res.slip) {
        audio.playSlip(pan)
      } else if (res.kind === "correct" || res.kind === "jump") {
        const pitch = res.worldIndex * 4 + res.slot // rising pentatonic across the climb
        if (res.object.shape === "keycap") {
          audio.playKeycap(useGame.getState().keycap, pitch, pan, res.flow)
        } else {
          audio.playKey(pitch, pan, res.object.sound, res.object.impact, res.flow)
        }
      } else if (res.kind === "error") {
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
        ref={sceneRef}
        style={{ backgroundImage: `linear-gradient(180deg, ${weather.sky[0]} 0%, ${weather.sky[1]} 45%, ${weather.sky[2]} 100%)` }}
      >
        <Scene />
        <div className="brand">thock</div>
        <div className="top-right">
          <div className="coin-chip" title="Coins — find them floating on rare platforms">
            <span className="coin-ico">🪙</span>
            <span className="coin-num">{coins}</span>
          </div>
          <button className="me-btn" onClick={() => setCustomizing(true)} title="Character & shop">👤</button>
          <AuthButtons />
        </div>
        {customizing && <Customizer onClose={() => setCustomizing(false)} />}
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
      {phase === "done" && <Results />}
    </div>
  )
}
