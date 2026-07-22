import { useGame } from "../game/store"
import { audio } from "../audio/AudioEngine"
import Dialog from "./Dialog"
import type { Settings as S, Quality, PassageType } from "../game/persist"

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.05 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label className="set-row">
      <span className="set-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="set-val">{Math.round(value * 100)}</span>
    </label>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`set-toggle tactile ${value ? "on" : ""}`}
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
    >
      <span className="set-label">{label}</span>
      <span className="set-knob" aria-hidden="true" />
    </button>
  )
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; t: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="set-row">
      <span className="set-label">{label}</span>
      <div className="set-seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.v} type="button" className={`set-seg-btn tactile ${value === o.v ? "on" : ""}`} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
            {o.t}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Settings({ onClose, onReplayTutorial }: { onClose: () => void; onReplayTutorial: () => void }) {
  const settings = useGame((s) => s.settings)
  const setSettings = useGame((s) => s.setSettings)
  const set = <K extends keyof S>(k: K, v: S[K]) => setSettings({ [k]: v } as Partial<S>)

  const previewProfile = () => {
    audio.start()
    const cap = useGame.getState().keycap
    ;[0, 2, 4, 7].forEach((p, i) => setTimeout(() => audio.playKeycap(cap, p, 0, 0.4), i * 130))
  }
  const stereoTest = () => {
    audio.start()
    audio.playCoin(-1)
    setTimeout(() => audio.playCoin(1), 420)
  }

  return (
    <Dialog title="Settings" onClose={onClose} className="cz-shop set-panel" labelId="set-title">
      <div className="cz-head">
        <span id="set-title">settings</span>
        <button className="cz-close tactile" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="set-section">
        <h3 className="set-h">audio</h3>
        <Slider label="master" value={settings.masterVolume} onChange={(v) => set("masterVolume", v)} />
        <Slider label="switches" value={settings.mechVolume} onChange={(v) => set("mechVolume", v)} />
        <Slider label="materials" value={settings.materialVolume} onChange={(v) => set("materialVolume", v)} />
        <Slider label="ambience" value={settings.ambienceVolume} onChange={(v) => set("ambienceVolume", v)} />
        <Slider label="reverb" value={settings.reverb} onChange={(v) => set("reverb", v)} />
        <Slider label="stereo width" value={settings.stereoWidth} onChange={(v) => set("stereoWidth", v)} />
        <Toggle label="mute" value={settings.muted} onChange={(v) => set("muted", v)} />
        <div className="set-btnrow">
          <button className="set-btn tactile" onClick={previewProfile}>preview keycaps</button>
          <button className="set-btn tactile" onClick={stereoTest}>stereo test (L→R)</button>
        </div>
      </div>

      <div className="set-section">
        <h3 className="set-h">visual</h3>
        <Segmented<Quality> label="quality" value={settings.quality} onChange={(v) => set("quality", v)} options={[{ v: "auto", t: "auto" }, { v: "low", t: "low" }, { v: "medium", t: "med" }, { v: "high", t: "high" }]} />
        <Toggle label="reduced motion" value={settings.reducedMotion} onChange={(v) => set("reducedMotion", v)} />
        <Toggle label="static camera" value={settings.staticCamera} onChange={(v) => set("staticCamera", v)} />
        <Toggle label="camera shake" value={settings.cameraShake} onChange={(v) => set("cameraShake", v)} />
        <Toggle label="shadows" value={settings.shadows} onChange={(v) => set("shadows", v)} />
        <Slider label="particles" value={settings.particleDensity} onChange={(v) => set("particleDensity", v)} />
        <Segmented<string> label="pixel cap" value={String(settings.pixelRatioCap)} onChange={(v) => set("pixelRatioCap", parseFloat(v))} options={[{ v: "1", t: "1×" }, { v: "1.5", t: "1.5×" }, { v: "2", t: "2×" }]} />
      </div>

      <div className="set-section">
        <h3 className="set-h">gameplay</h3>
        <Toggle label="zen strict falls" value={settings.strictFalls} onChange={(v) => set("strictFalls", v)} />
        <Toggle label="show wpm" value={settings.showWpm} onChange={(v) => set("showWpm", v)} />
        <Toggle label="show accuracy" value={settings.showAcc} onChange={(v) => set("showAcc", v)} />
        <Toggle label="show height" value={settings.showHeight} onChange={(v) => set("showHeight", v)} />
        <Toggle label="show flow" value={settings.showFlow} onChange={(v) => set("showFlow", v)} />
        <Segmented<PassageType> label="passage" value={settings.passageType} onChange={(v) => set("passageType", v)} options={[{ v: "words", t: "words" }, { v: "punctuation", t: "punct" }, { v: "numbers", t: "numbers" }, { v: "code", t: "code" }]} />
        <div className="set-btnrow">
          <button className="set-btn tactile" onClick={() => { onClose(); onReplayTutorial() }}>replay tutorial</button>
        </div>
      </div>
    </Dialog>
  )
}
