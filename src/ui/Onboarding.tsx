import { useEffect, useRef, useState } from "react"
import { audio } from "../audio/AudioEngine"
import { saveState } from "../game/persist"
import Dialog from "./Dialog"

type Step =
  | { kind: "intro" }
  | { kind: "type"; target: string; prompt: string }
  | { kind: "space"; prompt: string }
  | { kind: "backspace"; prompt: string }
  | { kind: "info"; prompt: string; sub: string }
  | { kind: "done" }

const STEPS: Step[] = [
  { kind: "intro" },
  { kind: "type", target: "type", prompt: "Type these letters to move." },
  { kind: "space", prompt: "Nice. Press Space to jump to the next word." },
  { kind: "backspace", prompt: "Type a wrong letter, then press Backspace to repair it." },
  { kind: "info", prompt: "Clean typing fills Flow", sub: "…and Flow enriches the sound — warmer reverb, a deeper climb." },
  { kind: "info", prompt: "Collect coins to unlock climbers", sub: "Coins float over rare platforms. Spend them in the gacha for new critters." },
  { kind: "done" },
]

export default function Onboarding({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const [typed, setTyped] = useState("")
  const [repaired, setRepaired] = useState<"idle" | "wrong" | "done">("idle")
  // refs mirror state so the (stable) key handler reads current values without
  // stale closures — and so side effects never live inside a setState updater
  // (StrictMode double-invokes updaters, which would double-fire `next`).
  const iRef = useRef(0)
  const typedRef = useRef("")
  const repairedRef = useRef<"idle" | "wrong" | "done">("idle")
  const step = STEPS[i]

  const next = () => setI((n) => Math.min(STEPS.length - 1, n + 1))
  const finish = () => {
    saveState({ tutorialSeen: true })
    onClose()
  }

  useEffect(() => {
    iRef.current = i
    typedRef.current = ""
    repairedRef.current = "idle"
    setTyped("")
    setRepaired("idle")
  }, [i])

  // scoped key capture (modal): advances the interactive steps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cur = STEPS[iRef.current]
      if (e.metaKey || e.ctrlKey || e.altKey || e.key === "Tab" || e.key === "Escape") return
      if (cur.kind === "type") {
        if (e.key === "Backspace") {
          e.preventDefault()
          typedRef.current = typedRef.current.slice(0, -1)
          setTyped(typedRef.current)
        } else if (e.key.length === 1) {
          e.preventDefault()
          audio.start()
          typedRef.current += e.key
          setTyped(typedRef.current)
          audio.playKeycap("mt3", typedRef.current.length, 0, 0.4)
          if (typedRef.current.replace(/\s+$/, "") === cur.target) setTimeout(next, 240)
        }
      } else if (cur.kind === "space" && e.key === " ") {
        e.preventDefault()
        audio.start()
        audio.playKeycap("mt3", 5, 0.3, 0.5)
        setTimeout(next, 160)
      } else if (cur.kind === "backspace") {
        if (e.key.length === 1 && e.key !== " ") {
          e.preventDefault()
          audio.start()
          audio.playDud(0)
          repairedRef.current = "wrong"
          setRepaired("wrong")
        } else if (e.key === "Backspace" && repairedRef.current === "wrong") {
          e.preventDefault()
          audio.playKeycap("mt3", 3, 0, 0.5)
          repairedRef.current = "done"
          setRepaired("done")
          setTimeout(next, 240)
        }
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  return (
    <Dialog title="How to climb" onClose={finish} className="onb-panel" labelId="onb-title">
      <div className="onb">
        <div className="onb-head">
          <span id="onb-title">how to climb</span>
          <button className="onb-skip tactile" onClick={finish}>skip</button>
        </div>

        {step.kind === "intro" && (
          <div className="onb-body">
            <div className="onb-big">🎧</div>
            <p className="onb-prompt">Put your headphones on.</p>
            <p className="onb-sub">Typemaxxing is audio-led — each key plays a spatial, pentatonic note.</p>
            <div className="onb-actions">
              <button className="onb-btn tactile" onClick={() => { audio.start(); audio.playCoin(-1); setTimeout(() => audio.playCoin(1), 420) }}>test stereo (L → R)</button>
              <button className="onb-btn primary tactile" onClick={next}>start</button>
            </div>
          </div>
        )}

        {step.kind === "type" && (
          <div className="onb-body">
            <p className="onb-prompt">{step.prompt}</p>
            <div className="onb-word">
              {step.target.split("").map((c, k) => {
                const state = k < typed.length ? (typed[k] === c ? "done" : "bad") : k === typed.length ? "cur" : "todo"
                return <span key={k} className={`onb-ch ${state}`}>{c}</span>
              })}
            </div>
            <p className="onb-sub">Wrong letters turn red — just keep going or Backspace.</p>
          </div>
        )}

        {step.kind === "space" && (
          <div className="onb-body">
            <p className="onb-prompt">{step.prompt}</p>
            <kbd className="onb-key">space</kbd>
          </div>
        )}

        {step.kind === "backspace" && (
          <div className="onb-body">
            <p className="onb-prompt">{step.prompt}</p>
            <div className="onb-word">
              <span className={`onb-ch ${repaired === "wrong" ? "bad" : "done"}`}>x</span>
            </div>
            <kbd className="onb-key">{repaired === "wrong" ? "backspace ↩" : "type any letter"}</kbd>
          </div>
        )}

        {step.kind === "info" && (
          <div className="onb-body">
            <p className="onb-prompt">{step.prompt}</p>
            <p className="onb-sub">{step.sub}</p>
            <div className="onb-actions">
              <button className="onb-btn primary tactile" onClick={next}>next</button>
            </div>
          </div>
        )}

        {step.kind === "done" && (
          <div className="onb-body">
            <p className="onb-prompt">That's it — go climb.</p>
            <div className="onb-actions">
              <button className="onb-btn primary tactile" onClick={finish}>start climbing</button>
            </div>
          </div>
        )}

        <div className="onb-dots" aria-hidden="true">
          {STEPS.map((_, k) => (
            <span key={k} className={`onb-dot ${k === i ? "on" : ""}`} />
          ))}
        </div>
      </div>
    </Dialog>
  )
}
