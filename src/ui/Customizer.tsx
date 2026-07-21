import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react"
import { useGame, type CharacterLook } from "../game/store"
import { catalog, skinById, isModel, type CharacterDef } from "../game/skins"
import { PixelSprite, skinPreviewURL, coinURL } from "../three/Character"
import { burstFrom, flyCoins, countTween } from "./fx"

const FURS = ["#e0561e", "#eaa33b", "#9aa1ab", "#f2a3c0", "#8fd8b8", "#b6a3e8"]
const ACCENTS = ["#5ff0d0", "#ff7eb0", "#7db4ff", "#ffcf5e", "#e05050", "#f5f2ff"]

/** Shop thumbnail: a 3D character's pre-rendered image if it has one, otherwise
 *  the pixel preview (always available — also the guaranteed sprite fallback). */
function cardThumb(def: CharacterDef): string {
  if (isModel(def) && def.model.thumb) return def.model.thumb
  return skinPreviewURL(def.id)
}

/** restart a one-shot CSS animation class (remove → reflow → add → clean up) */
function restart(el: HTMLElement | null, cls: string, ms = 700) {
  if (!el) return
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
  window.setTimeout(() => el.classList.remove(cls), ms)
}

function Row({ label, part, colors, current }: { label: string; part: keyof CharacterLook; colors: string[]; current: string }) {
  const setChar = useGame((s) => s.setChar)
  return (
    <div className="cz-row">
      <span className="cz-label">{label}</span>
      <div className="cz-swatches">
        {colors.map((c) => (
          <button
            key={c}
            className={`cz-swatch tactile ${c === current ? "on" : ""}`}
            style={{ background: c }}
            onClick={(e) => {
              setChar(part, c)
              burstFrom(e.currentTarget, { n: 5, colors: [c], spread: 34, size: 6 })
            }}
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

  const stageRef = useRef<HTMLDivElement>(null)
  const spriteWrap = useRef<HTMLDivElement>(null)
  const balanceRef = useRef<HTMLSpanElement>(null)

  // balance display tweens toward the real value (drains on buy, ticks up on pickup)
  const [shown, setShown] = useState(coins)
  const shownRef = useRef(coins)
  useEffect(() => {
    return countTween(shownRef.current, coins, 450, (v) => {
      shownRef.current = v
      setShown(v)
    })
  }, [coins])

  // the diorama critter reacts when the look changes: equip = big land, recolor = subtle refresh
  const prevSkin = useRef(character.skin)
  useEffect(() => {
    restart(spriteWrap.current, prevSkin.current !== character.skin ? "equip" : "refresh", 550)
    prevSkin.current = character.skin
  }, [character.skin, character.fur, character.accent])

  const onBuy = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    const card = (e.currentTarget as HTMLElement).closest(".cz-card") as HTMLElement | null
    const before = useGame.getState().coins
    buySkin(id)
    if (useGame.getState().coins < before) {
      flyCoins(balanceRef.current, card, coinURL(), 4) // you SEE the money leave your purse
      restart(card, "bought", 650)
      burstFrom(card, { n: 6, colors: ["#5ff0d0", "#ffe08a"] })
    }
  }

  const onEquip = (id: string) => {
    equipSkin(id)
    restart(stageRef.current, "equipping", 650) // aura swell + floor ring on the diorama
  }

  return (
    <div className="cz-backdrop" onClick={onClose}>
      <div className="cz-panel cz-shop" onClick={(e) => e.stopPropagation()}>
        <div className="cz-head">
          <span>character &amp; shop</span>
          <span className="cz-coins" ref={balanceRef}>
            <img className="coin-px" src={coinURL()} alt="" draggable={false} /> {shown}
          </span>
          <button className="cz-close tactile" onClick={onClose}>✕</button>
        </div>

        <div className="cz-body">
          <div className="cz-stage" ref={stageRef}>
            <div className="cz-stage-aura" />
            <div className="cz-shadow" />
            <div className="cz-sprite-wrap" ref={spriteWrap}>
              <PixelSprite look={character} className="cz-sprite" />
            </div>
          </div>
          <div className="cz-rows">
            {canRecolorFur && <Row label="fur" part="fur" colors={FURS} current={character.fur} />}
            <Row label="scarf" part="accent" colors={ACCENTS} current={character.accent} />
          </div>
        </div>

        <div className="cz-shop-label">skins</div>
        <div className="cz-grid">
          {catalog().map((skin, idx) => {
            const isOwned = owned.includes(skin.id)
            const isOn = character.skin === skin.id
            const canAfford = coins >= skin.price
            const affordable = isOwned || canAfford
            return (
              <div
                key={skin.id}
                className={`cz-card sheen ${isOn ? "on" : ""} ${affordable ? "affordable" : "locked"}`}
                style={{ "--i": idx } as CSSProperties}
              >
                {skin.kind === "model" && <span className="cz-tag cz-tag-3d">3D</span>}
                {skin.rarity && skin.rarity !== "common" && (
                  <span className={`cz-tag cz-rarity ${skin.rarity}`}>{skin.rarity}</span>
                )}
                <img
                  className={`cz-card-img ${isModel(skin) && skin.model.thumb ? "smooth" : ""}`}
                  src={cardThumb(skin)}
                  alt={skin.name}
                  draggable={false}
                />
                <div className="cz-card-name">{skin.name}</div>
                <div className="cz-card-blurb">{skin.blurb}</div>
                {isOwned ? (
                  <button className={`cz-card-btn tactile ${isOn ? "equipped" : ""}`} disabled={isOn} onClick={() => onEquip(skin.id)}>
                    {isOn ? "equipped" : "equip"}
                  </button>
                ) : (
                  <button
                    className="cz-card-btn buy tactile"
                    disabled={!canAfford}
                    onClick={(e) => onBuy(e, skin.id)}
                    title={canAfford ? `Buy for ${skin.price} coins` : `Need ${skin.price - coins} more coins`}
                  >
                    <img className="coin-px" src={coinURL()} alt="" draggable={false} /> {skin.price}
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
