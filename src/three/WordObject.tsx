import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import type { Group, Mesh, Material } from "three"
import { GAP, type ClimbObject, type Shape } from "../game/config"
import ObjectMesh, { ButterStick, SlimeBlob } from "./ObjectMesh"

export type Variant = "segmented" | "long"
export { GAP }

type BurstKind = "shard" | "splat" | "puff" | "drip" | "dust"
const BURST: Record<BurstKind, { count: number; life: number }> = {
  shard: { count: 8, life: 0.5 },
  splat: { count: 6, life: 0.5 },
  puff: { count: 6, life: 0.75 },
  drip: { count: 5, life: 0.6 },
  dust: { count: 6, life: 0.35 },
}

function burstKindFor(shape: Shape): BurstKind {
  if (shape === "chocolate" || shape === "ice") return "shard"
  if (shape === "jelly" || shape === "slime") return "splat"
  if (shape === "marshmallow" || shape === "bubble") return "puff"
  if (shape === "honey") return "drip"
  if (shape === "butter") return "splat"
  return "dust" // keycap
}

/** A material-flavored particle burst on landing: shards crack, jelly splats, marshmallow puffs, honey drips. */
function Burst({ trigger, kind, color, y }: { trigger: number; kind: BurstKind; color: string; y: number }) {
  const grp = useRef<Group>(null)
  const life = useRef(0)
  const prevT = useRef(trigger)
  const cfg = BURST[kind]
  const parts = useMemo(
    () =>
      Array.from({ length: cfg.count }, (_, i) => {
        const a = (i / cfg.count) * Math.PI * 2 + Math.random() * 0.6
        const r = 0.4 + Math.random() * 0.4
        return { dx: Math.cos(a) * r, dz: Math.sin(a) * r * 0.7, vy: 1 + Math.random() * 0.8, spin: Math.random() * 6 }
      }),
    [cfg.count]
  )

  useFrame((_, dt) => {
    const g = grp.current
    if (!g) return
    if (trigger !== prevT.current) {
      prevT.current = trigger
      life.current = cfg.life
    }
    if (life.current <= 0) {
      if (g.visible) g.visible = false
      return
    }
    g.visible = true
    life.current -= dt
    const frac = Math.max(0, life.current / cfg.life) // 1 -> 0
    const t = 1 - frac
    g.children.forEach((ch, i) => {
      const p = parts[i]
      if (!p) return
      let px = p.dx, py = 0, pz = p.dz, sx = 1, sy = 1, sz = 1, op = 1
      if (kind === "shard") {
        px = p.dx * t * 1.6; py = p.vy * t - 3.2 * t * t; pz = p.dz * t * 1.6; sx = sy = sz = frac
        ch.rotation.set(t * p.spin * 5, t * p.spin * 4, 0)
      } else if (kind === "splat") {
        px = p.dx * t * 2; py = p.vy * 0.5 * t - 3.6 * t * t; pz = p.dz * t * 2; sx = sz = frac * 1.2; sy = frac * 0.4; op = frac
      } else if (kind === "puff") {
        px = p.dx * t * 0.7; py = 0.9 * t; pz = p.dz * t * 0.7; sx = sy = sz = 0.5 + t * 1.1; op = frac * 0.8
      } else if (kind === "drip") {
        px = p.dx * t * 0.5; py = -1.3 * t - 1.4 * t * t; pz = p.dz * t * 0.5; sx = sy = sz = frac; op = 0.9
      } else {
        px = p.dx * t * 1.3; py = 0.5 * t; pz = p.dz * t * 1.3; sx = sy = sz = frac * 0.7; op = frac * 0.5
      }
      ch.position.set(px, py, pz)
      ch.scale.set(sx, sy, sz)
      const m = (ch as Mesh).material as Material & { opacity: number }
      if (m && "opacity" in m) m.opacity = op
    })
  })

  const goo = kind === "splat" || kind === "drip"
  const size = kind === "shard" ? 0.11 : kind === "dust" ? 0.07 : kind === "puff" ? 0.12 : 0.1
  return (
    <group ref={grp} visible={false} position={[0, y, 0]}>
      {parts.map((_, i) => (
        <mesh key={i}>
          {kind === "shard" ? <tetrahedronGeometry args={[size]} /> : <sphereGeometry args={[size, 10, 8]} />}
          {goo ? (
            <meshPhysicalMaterial color={color} roughness={0.12} transmission={0.4} thickness={0.4} clearcoat={1} transparent />
          ) : kind === "dust" ? (
            <meshBasicMaterial color={color} transparent />
          ) : (
            <meshStandardMaterial color={color} roughness={kind === "puff" ? 1 : 0.5} transparent />
          )}
        </mesh>
      ))}
    </group>
  )
}

type Landing = "press" | "crack" | "pop" | "squish"
function landingFor(shape: ClimbObject["shape"]): Landing {
  if (shape === "keycap") return "press"
  if (shape === "chocolate" || shape === "ice") return "crack"
  if (shape === "bubble") return "pop"
  return "squish"
}

/** A few thin lines that flash on when a hard object cracks. */
function CrackLines({ groupRef, color, y }: { groupRef: RefObject<Group | null>; color: string; y: number }) {
  const lines: [number, number][] = [[0.2, 0.02], [-0.4, 0.55], [1.9, -0.5]]
  return (
    <group ref={groupRef} visible={false} position={[0, y, 0]}>
      {lines.map(([rot, z], i) => (
        <mesh key={i} rotation={[0, rot, 0]} position={[0, 0, z * 0.3]}>
          <boxGeometry args={[0.62, 0.03, 0.04]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

/** One letter-piece in a segmented word: glows under the blob + reacts on landing. */
function LetterPiece({ object, char, index, blobSlot, typedCount }: { object: ClimbObject; char: string; index: number; blobSlot: number; typedCount: number }) {
  const g = useRef<Group>(null)
  const crack = useRef<Group>(null)
  const impact = useRef(0)
  const wasBlob = useRef(false)
  const [burst, setBurst] = useState(0)
  const typed = index < typedCount
  const hasBlob = index === blobSlot
  const glow = hasBlob ? 0.5 : typed ? 0.06 : 0
  const style = landingFor(object.shape)
  const isKeycap = object.shape === "keycap"

  useEffect(() => {
    if (hasBlob && !wasBlob.current) {
      impact.current = 1 // blob just landed here
      setBurst((b) => b + 1) // every landing bursts its material's particles
    }
    wasBlob.current = hasBlob
  }, [hasBlob])

  useFrame((_, dt) => {
    const el = g.current
    if (!el) return
    impact.current = Math.max(0, impact.current - dt * 4.5)
    const k = impact.current
    let sx = 1, sy = 1, sz = 1, y = 0
    if (style === "press") y = -0.18 * k
    else if (style === "pop") { const e = 1 + Math.sin(k * Math.PI) * 0.3; sx = sy = sz = e }
    else if (style === "crack") { sy = 1 - k * 0.14; sx = 1 + k * 0.09; sz = 1 + k * 0.09 }
    else { sx = 1 + k * 0.18; sy = 1 - k * 0.32; sz = 1 + k * 0.18 }
    if (hasBlob && style !== "press") y += Math.sin(performance.now() / 300) * 0.03
    el.scale.set(sx, sy, sz)
    el.position.y = y
    if (crack.current) crack.current.visible = k > 0.12
  })

  return (
    <group ref={g}>
      <ObjectMesh object={object} char={char} glow={glow} />
      <Burst trigger={burst} kind={burstKindFor(object.shape)} color={object.color} y={object.halfHeight + 0.05} />
      {style === "crack" && (
        <CrackLines groupRef={crack} color={object.shape === "ice" ? "#eaffff" : "#1c0f07"} y={object.halfHeight + 0.02} />
      )}
      {/* per-key RGB glow under the key the character is standing on */}
      {isKeycap && hasBlob && (
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[1.0, 0.14, 1.0]} />
          <meshBasicMaterial color="#5ff0d0" toneMapped={false} transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  )
}

interface Props {
  object: ClimbObject
  word: string
  variant: Variant
  blobSlot?: number // (segmented) letter the character is on; -1 otherwise
  typedCount?: number // (segmented) letters already typed
  caret?: number // (long) caret slot in this word; -1 if not the current word — gets a gentle glow
  crossed?: boolean // (long) the cat has fully climbed past this word — ice reads fully cracked
}

/**
 * A whole word rendered as a climb platform. Both variants tile the detailed
 * per-letter ObjectMesh (real keycaps, slumped jelly, honeycomb cells, …) so a
 * word reads as a row of authentic objects. No letters are drawn on the 3D
 * objects themselves — the typing bar carries the text.
 */
export default function WordObject({ object, word, variant, blobSlot = -1, typedCount = 0, caret = -1, crossed = false }: Props) {
  const chars = word.split("")
  const n = chars.length
  const slot = (i: number) => (i - (n - 1) / 2) * GAP
  const isKeycap = object.shape === "keycap"

  // segmented: legacy per-letter jump model (kept for reference / possible reuse)
  if (variant === "segmented") {
    return (
      <group>
        {isKeycap && <KeyboardBase n={n} />}
        {chars.map((ch, i) => (
          <group key={i} position={[slot(i), 0, 0]}>
            <LetterPiece object={object} char={ch} index={i} blobSlot={blobSlot} typedCount={typedCount} />
          </group>
        ))}
      </group>
    )
  }

  // long: continuous walkable platform of detailed objects, one per letter, no labels
  // butter is a special case — one seamless stick spanning the whole word.
  if (object.shape === "butter") {
    return (
      <group>
        <ButterStick n={n} gap={GAP} caret={caret} crossed={crossed} />
      </group>
    )
  }
  // slime is one continuous gooey platform, randomized per word.
  if (object.shape === "slime") {
    const seed = word.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), n)
    return (
      <group>
        <SlimeBlob object={object} n={n} gap={GAP} seed={seed} caret={caret} />
      </group>
    )
  }
  return (
    <group>
      {isKeycap && <KeyboardBase n={n} />}
      {chars.map((_, i) => {
        const hasCat = i === caret
        // crack level: fully-crossed word → 2; current word → 2 behind caret, 1 at caret, 0 ahead
        const crackLevel = crossed ? 2 : caret < 0 ? 0 : i < caret ? 2 : i === caret ? 1 : 0
        return (
          <group key={i} position={[slot(i), 0, 0]}>
            <ObjectMesh object={object} glow={hasCat ? 0.42 : 0} showLetter={false} seed={i * 31 + n} crack={crackLevel} />
            {/* the key the cat stands on lights up — RGB keyboard vibe */}
            {isKeycap && hasCat && (
              <mesh position={[0, -0.22, 0]}>
                <boxGeometry args={[1.0, 0.14, 1.0]} />
                <meshBasicMaterial color="#5ff0d0" toneMapped={false} transparent opacity={0.85} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

/** Shared keyboard deck under a keycap word: base plate + RGB underglow strip. */
function KeyboardBase({ n }: { n: number }) {
  return (
    <>
      <RoundedBox args={[n * GAP + 0.4, 0.24, 1.5]} radius={0.1} smoothness={4} position={[0, -0.34, 0]}>
        <meshPhysicalMaterial color="#1c2029" roughness={0.5} clearcoat={0.3} />
      </RoundedBox>
      <mesh position={[0, -0.52, 0]}>
        <boxGeometry args={[n * GAP + 0.55, 0.1, 1.65]} />
        <meshBasicMaterial color="#7ad0ff" toneMapped={false} />
      </mesh>
    </>
  )
}
