import { useEffect, useRef, useState } from "react"
import Scene from "./three/Scene"
import Gallery from "./three/Gallery"
import KeycapGallery from "./three/KeycapGallery"
import DesignLab from "./three/DesignLab"
import TypingBar from "./ui/TypingBar"
import TypingInput from "./ui/TypingInput"
import Hud from "./ui/Hud"
import Customizer from "./ui/Customizer"
import Settings from "./ui/Settings"
import Onboarding from "./ui/Onboarding"
import Results from "./ui/Results"
import { AuthButtons } from "./auth/Auth"
import { coinURL } from "./three/Character"
import { useGame } from "./game/store"
import { loadState } from "./game/persist"
import { audio } from "./audio/AudioEngine"
import { hexLerp } from "./game/config"

export default function App() {
  const [started, setStarted] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [onboarding, setOnboarding] = useState(() => !loadState().tutorialSeen)
  const weather = useGame((s) => s.weather)
  const coins = useGame((s) => s.coins)
  const coinNonce = useGame((s) => s.coinNonce)
  const phase = useGame((s) => s.phase)
  const settings = useGame((s) => s.settings)
  const coinChip = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const anyModal = customizing || settingsOpen || onboarding || phase === "done"

  // keep the audio mix in sync with settings (applies once the ctx exists)
  useEffect(() => {
    audio.applyAudioSettings(settings)
  }, [settings, started])

  // pulse the coin chip on every physical pickup
  useEffect(() => {
    if (!coinNonce) return
    const el = coinChip.current
    if (!el) return
    el.classList.remove("pickup")
    void el.offsetWidth
    el.classList.add("pickup")
    const t = setTimeout(() => el.classList.remove("pickup"), 650)
    return () => clearTimeout(t)
  }, [coinNonce])

  // crossfade the sky toward the current weather
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

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const isGallery = params.has("gallery")
  const isKeycaps = params.has("keycaps")
  const isDesign = params.has("design")

  useEffect(() => {
    audio.setAmbience(weather.name)
  }, [weather.name])

  useEffect(() => {
    void audio.loadManifest()
  }, [])

  // timed modes end when the (pause-aware) clock runs out
  useEffect(() => {
    const id = setInterval(() => {
      const st = useGame.getState()
      if (st.phase === "running" && st.mode !== "zen" && st.startTime && st.pausedAt == null) {
        if (Date.now() - st.startTime >= (st.mode as number) * 1000) st.endRun()
      }
    }, 150)
    return () => clearInterval(id)
  }, [])

  // pause the run clock while the tab is hidden; resume on return
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) useGame.getState().pauseClock()
      else if (!anyModal) useGame.getState().resumeClock()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [anyModal])

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
        <div className="brand">typemaxxing</div>
        <div className="top-right">
          <div className="coin-chip tactile" ref={coinChip} title="Coins — find them floating on rare platforms">
            <img className="coin-px coin-ico" src={coinURL()} alt="coins" draggable={false} />
            <span className="coin-num">{coins}</span>
          </div>
          <button className="me-btn tactile" onClick={() => setCustomizing(true)} title="Characters & gacha" aria-label="Characters and gacha">
            <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true">
              <ellipse cx="12" cy="16" rx="5.2" ry="4.3" />
              <ellipse cx="6.2" cy="10.6" rx="2.1" ry="2.7" />
              <ellipse cx="9.8" cy="7.6" rx="2.1" ry="2.9" />
              <ellipse cx="14.2" cy="7.6" rx="2.1" ry="2.9" />
              <ellipse cx="17.8" cy="10.6" rx="2.1" ry="2.7" />
            </svg>
          </button>
          <button className="me-btn tactile" onClick={() => setSettingsOpen(true)} title="Settings" aria-label="Settings">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <AuthButtons />
        </div>

        {customizing && <Customizer onClose={() => setCustomizing(false)} />}
        {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} onReplayTutorial={() => setOnboarding(true)} />}
        {onboarding && <Onboarding onClose={() => setOnboarding(false)} />}

        {!started && !anyModal && (
          <div className="hint">
            <p>start typing to climb</p>
            <p className="sub">headphones recommended · esc pauses · alt+n new climb</p>
          </div>
        )}
      </div>

      <div className="panel" onMouseDown={() => { if (!anyModal) inputRef.current?.focus() }}>
        <Hud />
        <TypingInput
          inputRef={inputRef}
          suppressed={anyModal}
          onStarted={() => {
            if (!started) {
              setStarted(true)
              audio.setAmbience(useGame.getState().weather.name)
            }
          }}
        />
        <TypingBar />
      </div>

      {phase === "done" && <Results />}
    </div>
  )
}
