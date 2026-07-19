import { useGame, type CharacterLook } from "../game/store"
import { SKINS, skinById } from "../game/skins"
import { catPreviewURL, skinPreviewURL } from "../three/Character"

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
  const coins = useGame((s) => s.coins)
  const owned = useGame((s) => s.ownedSkins)
  const buySkin = useGame((s) => s.buySkin)
  const equipSkin = useGame((s) => s.equipSkin)
  const species = skinById(character.skin).species
  const canRecolorFur = species === "cat" || species === "fox"

  return (
    <div className="cz-backdrop" onClick={onClose}>
      <div className="cz-panel cz-shop" onClick={(e) => e.stopPropagation()}>
        <div className="cz-head">
          <span>character &amp; shop</span>
          <span className="cz-coins">🪙 {coins}</span>
          <button className="cz-close" onClick={onClose}>✕</button>
        </div>

        <div className="cz-body">
          <img className="cz-preview" src={catPreviewURL(character)} alt="your character" />
          <div className="cz-rows">
            {canRecolorFur && <Row label="fur" part="fur" colors={FURS} current={character.fur} />}
            <Row label="scarf" part="accent" colors={ACCENTS} current={character.accent} />
          </div>
        </div>

        <div className="cz-shop-label">skins</div>
        <div className="cz-grid">
          {SKINS.map((skin) => {
            const isOwned = owned.includes(skin.id)
            const isOn = character.skin === skin.id
            const canAfford = coins >= skin.price
            return (
              <div key={skin.id} className={`cz-card ${isOn ? "on" : ""}`}>
                <img className="cz-card-img" src={skinPreviewURL(skin.id)} alt={skin.name} />
                <div className="cz-card-name">{skin.name}</div>
                <div className="cz-card-blurb">{skin.blurb}</div>
                {isOwned ? (
                  <button className={`cz-card-btn ${isOn ? "equipped" : ""}`} disabled={isOn} onClick={() => equipSkin(skin.id)}>
                    {isOn ? "equipped" : "equip"}
                  </button>
                ) : (
                  <button
                    className="cz-card-btn buy"
                    disabled={!canAfford}
                    onClick={() => buySkin(skin.id)}
                    title={canAfford ? `Buy for ${skin.price} coins` : `Need ${skin.price - coins} more coins`}
                  >
                    🪙 {skin.price}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
