import { useGame, type CharacterLook } from "../game/store"
import { catPreviewURL } from "../three/Character"

const FURS = ["#e0561e", "#eaa33b", "#9aa1ab", "#f2a3c0", "#8fd8b8", "#b6a3e8"]
const ACCENTS = ["#5ff0d0", "#ff7eb0", "#7db4ff", "#ffcf5e", "#e05050", "#f5f2ff"]

function Row({ label, part, colors, current }: { label: string; part: keyof CharacterLook; colors: string[]; current: string }) {
  const setChar = useGame((s) => s.setChar)
  return (
    <div className="cz-row">
      <span className="cz-label">{label}</span>
      <div className="cz-swatches">
        {colors.map((c) => (
          <button
            key={c}
            className={`cz-swatch ${c === current ? "on" : ""}`}
            style={{ background: c }}
            onClick={() => setChar(part, c)}
            aria-label={`${label} ${c}`}
          />
        ))}
      </div>
    </div>
  )
}

export default function Customizer({ onClose }: { onClose: () => void }) {
  const character = useGame((s) => s.character)
  return (
    <div className="cz-backdrop" onClick={onClose}>
      <div className="cz-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cz-head">
          <span>customize</span>
          <button className="cz-close" onClick={onClose}>✕</button>
        </div>
        <div className="cz-body">
          <img className="cz-preview" src={catPreviewURL(character)} alt="your cat" />
          <div className="cz-rows">
            <Row label="fur" part="fur" colors={FURS} current={character.fur} />
            <Row label="scarf" part="accent" colors={ACCENTS} current={character.accent} />
          </div>
        </div>
      </div>
    </div>
  )
}
