import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useGame, type CharacterLook } from "../game/store"
import { catalog, gachaPool, skinById, PULL_COST, type CharacterDef, type Rarity } from "../game/skins"
import { PixelSprite, skinPreviewURL, coinURL } from "../three/Character"
import { burstFrom, flyCoins, countTween } from "./fx"
import GachaMachine from "./GachaMachine"
import Dialog from "./Dialog"

// fixed twinkle positions (% within the diorama) so the starfield is stable across renders
const STARS = [
  { x: 12, y: 20, d: 0 }, { x: 82, y: 16, d: 0.6 }, { x: 68, y: 34, d: 1.2 },
  { x: 26, y: 62, d: 0.9 }, { x: 90, y: 58, d: 1.6 }, { x: 44, y: 14, d: 2.1 },
  { x: 8, y: 74, d: 1.4 }, { x: 74, y: 78, d: 0.3 },
]

const FURS = ["#e0561e", "#eaa33b", "#9aa1ab", "#f2a3c0", "#8fd8b8", "#b6a3e8"]

// particle colors for the reveal burst, keyed to the rarity ring hues
const RARITY_FX: Record<Rarity, string[]> = {
  common: ["#cdd3e6", "#ffffff"],
  rare: ["#7db4ff", "#bfe0ff"],
  epic: ["#c3b0f0", "#e6dcff"],
  legendary: ["#ffcf5e", "#fff0b8"],
  mythic: ["#ff8ad0", "#ffd0ec"],
}

type Prize = { animal: CharacterDef; rarity: Rarity; isNew: boolean; refund: number }

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
  const pull = useGame((s) => s.pull)
  const equipSkin = useGame((s) => s.equipSkin)
  const species = skinById(character.skin).species
  const canRecolorFur = species === "cat" || species === "fox"

  const stageRef = useRef<HTMLDivElement>(null)
  const spriteWrap = useRef<HTMLDivElement>(null)
  const balanceRef = useRef<HTMLSpanElement>(null)
  const crankRef = useRef<HTMLButtonElement>(null)
  const prizeRef = useRef<HTMLDivElement>(null)

  const [cranking, setCranking] = useState(false)
  const [prize, setPrize] = useState<Prize | null>(null)

  // balance display tweens toward the real value (drains on crank, ticks up on pickup)
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

  // when a prize lands, spray rarity-colored confetti + fly any refund into the purse
  useEffect(() => {
    if (!prize) return
    const el = prizeRef.current
    burstFrom(el, { n: 20, colors: RARITY_FX[prize.rarity], spread: 130, size: 7 })
    if (prize.refund > 0) flyCoins(balanceRef.current, el, coinURL(), 4)
  }, [prize])

  const pool = gachaPool()
  const collected = pool.filter((p) => owned.includes(p.id)).length

  const onCrank = () => {
    if (cranking) return
    if (useGame.getState().coins < PULL_COST) {
      restart(crankRef.current, "nope", 420)
      return
    }
    setCranking(true)
    flyCoins(balanceRef.current, crankRef.current, coinURL(), 3) // coins tumble into the machine
    const r = pull()
    if ("error" in r) {
      setCranking(false)
      return
    }
    window.setTimeout(() => {
      setCranking(false)
      setPrize(r)
    }, 950)
  }

  const onEquip = (id: string) => {
    equipSkin(id)
    restart(stageRef.current, "equipping", 650)
  }

  const poor = coins < PULL_COST

  return (
    <Dialog title="Characters" onClose={onClose} className="cz-shop" labelId="cz-title">
        <div className="cz-head">
          <span id="cz-title">characters</span>
          <span className="cz-coins" ref={balanceRef}>
            <img className="coin-px" src={coinURL()} alt="" draggable={false} /> {shown}
          </span>
          <button className="cz-close tactile" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="cz-body">
          <div className="cz-stage" ref={stageRef}>
            <div className="cz-stars" aria-hidden="true">
              {STARS.map((s, i) => (
                <span key={i} className="cz-star" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }} />
              ))}
            </div>
            <div className="cz-stage-aura" />
            <div className="cz-shadow" />
            <div className="cz-sprite-wrap" ref={spriteWrap}>
              <PixelSprite look={character} className="cz-sprite" />
            </div>
          </div>
          {canRecolorFur && (
            <div className="cz-rows">
              <Row label="fur" part="fur" colors={FURS} current={character.fur} />
            </div>
          )}
        </div>

        <div className="cz-shop-label">gacha</div>
        <div className={`gacha ${cranking ? "cranking" : ""}`}>
          <div className="gacha-machine">
            <GachaMachine cranking={cranking} />
          </div>
          <div className="gacha-side">
            <p className="gacha-pitch">Crank for a random critter. Rarer animals, longer odds.</p>
            <button
              className="gacha-crank tactile"
              ref={crankRef}
              onClick={onCrank}
              disabled={cranking}
              aria-label={`Crank the gacha for ${PULL_COST} coins`}
            >
              <img className="coin-px" src={coinURL()} alt="" draggable={false} />
              <span>{cranking ? "cranking…" : `crank · ${PULL_COST}`}</span>
            </button>
            {poor && <span className="gacha-poor">need {PULL_COST - coins} more — climb to earn coins</span>}
          </div>
        </div>

        <div className="cz-shop-label">
          collection <span className="coll-count">{collected}/{pool.length}</span>
        </div>
        <div className="coll-grid">
          {catalog().map((a, idx) => {
            const isOwned = a.isDefault || owned.includes(a.id)
            const isOn = character.skin === a.id
            if (!isOwned) {
              return (
                <div key={a.id} className="coll-tile locked" style={{ "--i": idx } as CSSProperties} title="Locked — crank the gacha">
                  <span className="coll-q">?</span>
                </div>
              )
            }
            return (
              <button
                key={a.id}
                className={`coll-tile owned tactile ${a.rarity ?? "common"} ${isOn ? "on" : ""}`}
                style={{ "--i": idx } as CSSProperties}
                onClick={() => onEquip(a.id)}
                disabled={isOn}
                title={isOn ? `${a.name} — equipped` : `Equip ${a.name}`}
              >
                {a.rarity && a.rarity !== "common" && <span className={`coll-rarity ${a.rarity}`}>{a.rarity}</span>}
                <img className="coll-img" src={skinPreviewURL(a.id)} alt={a.name} draggable={false} />
                <span className="coll-name">{a.name}</span>
                <span className="coll-eq">{isOn ? "equipped" : "equip"}</span>
              </button>
            )
          })}
        </div>

        {prize && (
          <div className="gacha-reveal" onClick={() => setPrize(null)}>
            <div className={`gacha-prize ${prize.rarity}`} ref={prizeRef} onClick={(e) => e.stopPropagation()}>
              <div className="gacha-aura" />
              <span className={`gacha-prize-rarity ${prize.rarity}`}>{prize.rarity}</span>
              <img className="gacha-prize-img" src={skinPreviewURL(prize.animal.id)} alt={prize.animal.name} draggable={false} />
              <div className="gacha-prize-name">{prize.animal.name}</div>
              {prize.isNew ? (
                <div className="gacha-prize-tag new">NEW!</div>
              ) : (
                <div className="gacha-prize-tag dupe">
                  duplicate · <img className="coin-px" src={coinURL()} alt="" draggable={false} /> +{prize.refund}
                </div>
              )}
              <div className="gacha-prize-actions">
                {prize.isNew && (
                  <button
                    className="gacha-btn primary tactile"
                    onClick={() => {
                      onEquip(prize.animal.id)
                      setPrize(null)
                    }}
                  >
                    equip
                  </button>
                )}
                <button
                  className="gacha-btn tactile"
                  disabled={poor}
                  onClick={() => {
                    setPrize(null)
                    onCrank()
                  }}
                >
                  crank again
                </button>
                <button className="gacha-btn ghost tactile" onClick={() => setPrize(null)}>
                  done
                </button>
              </div>
            </div>
          </div>
        )}
    </Dialog>
  )
}
