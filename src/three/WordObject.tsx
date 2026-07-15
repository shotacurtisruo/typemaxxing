import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { RoundedBox, Text } from "@react-three/drei"
import type { Group, Mesh, Material } from "three"
import { GAP, type ClimbObject, type Shape } from "../game/config"
import type { Mark } from "../game/store"
import ObjectMesh from "./ObjectMesh"

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

function LMat({ o, color }: { o: ClimbObject; color?: string }) {
  return (
    <meshPhysicalMaterial
      color={color ?? o.color}
      roughness={o.roughness}
      metalness={o.metalness}
      transmission={o.transmission}
      thickness={0.7}
      ior={o.shape === "ice" || o.shape === "bubble" ? 1.31 : 1.3}
      clearcoat={o.transmission > 0 || o.shape === "chocolate" ? 1 : 0.3}
      clearcoatRoughness={0.15}
    />
  )
}

/** Tiny trapped air bubble for translucent bodies. */
function AirBubble({ pos, r }: { pos: [number, number, number]; r: number }) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[r, 10, 8]} />
      <meshStandardMaterial color="#ffffff" transparent opacity={0.5} roughness={0.2} depthWrite={false} />
    </mesh>
  )
}

/** One continuous elongated piece spanning the whole word — full detail, elongated. */
function LongMesh({ object: o, n }: { object: ClimbObject; n: number }) {
  const L = Math.max(n, 1) * GAP
  const slots = Array.from({ length: Math.max(n, 1) }, (_, i) => (i - (n - 1) / 2) * GAP)
  switch (o.shape) {
    case "keycap": // a long spacebar on a base plate with RGB underglow
      return (
        <group>
          <RoundedBox args={[L + 0.4, 0.24, 1.5]} radius={0.1} smoothness={4} position={[0, -0.38, 0]}>
            <meshPhysicalMaterial color="#1c2029" roughness={0.5} clearcoat={0.3} />
          </RoundedBox>
          <mesh position={[0, -0.55, 0]}>
            <boxGeometry args={[L + 0.55, 0.1, 1.65]} />
            <meshBasicMaterial color="#7ad0ff" toneMapped={false} />
          </mesh>
          <RoundedBox args={[L, 0.3, 1.16]} radius={0.05} smoothness={4} position={[0, -0.11, 0]}>
            <LMat o={o} color="#3c4450" />
          </RoundedBox>
          <RoundedBox args={[L - 0.18, 0.3, 0.98]} radius={0.08} smoothness={4} position={[0, 0.12, 0]}>
            <LMat o={o} color="#454e5c" />
          </RoundedBox>
        </group>
      )
    case "chocolate": // rimmed slab + tight beveled squares per letter
      return (
        <group>
          <RoundedBox args={[L + 0.06, 0.18, 1.12]} radius={0.04} smoothness={3} position={[0, -0.13, 0]}>
            <LMat o={o} color="#472a10" />
          </RoundedBox>
          {slots.map((x, i) =>
            [-0.25, 0.25].map((z, j) => (
              <RoundedBox key={`${i}-${j}`} args={[GAP * 0.72, 0.2, 0.44]} radius={0.05} smoothness={3} position={[x, 0.11, z]}>
                <LMat o={o} />
              </RoundedBox>
            ))
          )}
        </group>
      )
    case "jelly": // slumped gelatin loaf with trapped micro-bubbles
      return (
        <group>
          <RoundedBox args={[L + 0.08, 0.36, 1.08]} radius={0.16} smoothness={4} position={[0, -0.28, 0]}>
            <LMat o={o} />
          </RoundedBox>
          <RoundedBox args={[L - 0.04, 0.88, 0.96]} radius={0.2} smoothness={5} position={[0, 0.02, 0]}>
            <LMat o={o} />
          </RoundedBox>
          {slots.map((x, i) => (
            <AirBubble key={i} pos={[x + (i % 2 ? 0.15 : -0.12), 0.08 + (i % 3) * 0.1, i % 2 ? -0.08 : 0.12]} r={0.04} />
          ))}
        </group>
      )
    case "butter": // pale stick with a deeper-yellow cut face
      return (
        <group>
          <RoundedBox args={[L - 0.14, 0.5, 0.72]} radius={0.05} smoothness={3} position={[-0.07, 0, 0]}>
            <LMat o={o} />
          </RoundedBox>
          <RoundedBox args={[0.14, 0.46, 0.68]} radius={0.04} smoothness={3} position={[L / 2 - 0.06, 0, 0]}>
            <LMat o={o} color="#e9bd41" />
          </RoundedBox>
        </group>
      )
    case "marshmallow": // long puffy capsule
      return (
        <mesh rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1]}>
          <capsuleGeometry args={[0.48, Math.max(0.2, L - 0.96), 8, 24]} />
          <LMat o={o} />
        </mesh>
      )
    case "bubble": // stretched soap film, iridescent + see-through
      return (
        <mesh scale={[L / 0.92, 1, 1]}>
          <sphereGeometry args={[0.46, 40, 28]} />
          <meshPhysicalMaterial
            color="#dcefff"
            transparent
            opacity={0.24}
            depthWrite={false}
            roughness={0}
            metalness={0}
            ior={1.33}
            iridescence={1}
            iridescenceIOR={1.33}
            iridescenceThicknessRange={[120, 480]}
            clearcoat={1}
            clearcoatRoughness={0}
          />
        </mesh>
      )
    case "ice": // glassy block with a cloudy frozen core + hairline cracks
      return (
        <group>
          <RoundedBox args={[L, 0.8, 0.9]} radius={0.08} smoothness={4}>
            <meshPhysicalMaterial
              color="#cfeaff"
              transparent
              opacity={0.55}
              depthWrite={false}
              roughness={0.03}
              metalness={0}
              ior={1.31}
              clearcoat={1}
              clearcoatRoughness={0.05}
            />
          </RoundedBox>
          <RoundedBox args={[L * 0.5, 0.38, 0.42]} radius={0.12} smoothness={3}>
            <meshStandardMaterial color="#ffffff" transparent opacity={0.55} roughness={1} depthWrite={false} />
          </RoundedBox>
          <mesh rotation={[0.4, 0.5, 0.25]} position={[-L * 0.18, 0.12, 0.05]}>
            <boxGeometry args={[0.68, 0.012, 0.012]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.65} />
          </mesh>
          <mesh rotation={[-0.3, -0.7, 0.55]} position={[L * 0.2, -0.08, -0.04]}>
            <boxGeometry args={[0.5, 0.01, 0.01]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
          </mesh>
        </group>
      )
    case "honey": // a row of honeycomb cells: wax walls + recessed amber pools + a drip
      return (
        <group>
          {slots.map((x, i) => (
            <group key={i} position={[x, 0, 0]} rotation={[0, Math.PI / 6, 0]}>
              <mesh>
                <cylinderGeometry args={[0.56, 0.56, 0.56, 6]} />
                <meshPhysicalMaterial color="#a86a00" roughness={0.55} clearcoat={0.4} clearcoatRoughness={0.3} />
              </mesh>
              <mesh position={[0, -0.04, 0]}>
                <cylinderGeometry args={[0.45, 0.45, 0.44, 6]} />
                <LMat o={o} />
              </mesh>
              {i === Math.floor(slots.length / 2) && (
                <mesh position={[0.34, -0.34, 0.14]} scale={[0.5, 1, 0.5]}>
                  <sphereGeometry args={[0.13, 12, 10]} />
                  <LMat o={o} />
                </mesh>
              )}
            </group>
          ))}
        </group>
      )
    case "slime": // gooey stretched blob with drips + trapped bubbles
      return (
        <group>
          <mesh scale={[L / 1.3, 0.72, 1]}>
            <icosahedronGeometry args={[0.58, 3]} />
            <LMat o={o} />
          </mesh>
          <mesh position={[L * 0.32, -0.26, 0.12]} scale={[0.5, 0.6, 0.5]}>
            <icosahedronGeometry args={[0.3, 2]} />
            <LMat o={o} />
          </mesh>
          <mesh position={[-L * 0.3, -0.28, -0.06]} scale={[0.4, 0.75, 0.4]}>
            <icosahedronGeometry args={[0.26, 2]} />
            <LMat o={o} />
          </mesh>
          <AirBubble pos={[-L * 0.12, 0.08, 0.16]} r={0.05} />
          <AirBubble pos={[L * 0.15, -0.04, -0.1]} r={0.035} />
        </group>
      )
  }
}

interface Props {
  object: ClimbObject
  word: string
  variant: Variant
  blobSlot?: number // (segmented) letter the character is on; -1 otherwise
  typedCount?: number // (segmented) letters already typed
  marks?: Mark[] // (long) per-letter typing state for coloring
  caret?: number // (long) caret slot in this word; -1 if not the current word
}

/** A whole word rendered as a single climb object. */
export default function WordObject({ object, word, variant, blobSlot = -1, typedCount = 0, marks, caret = -1 }: Props) {
  const chars = word.split("")
  const n = chars.length
  const slot = (i: number) => (i - (n - 1) / 2) * GAP
  const topY = object.halfHeight

  if (variant === "segmented") {
    return (
      <group>
        {/* keyboard base plate + RGB underglow */}
        {object.shape === "keycap" && (
          <>
            <RoundedBox args={[n * GAP + 0.4, 0.24, 1.5]} radius={0.1} smoothness={4} position={[0, -0.34, 0]}>
              <meshPhysicalMaterial color="#1c2029" roughness={0.5} clearcoat={0.3} />
            </RoundedBox>
            <mesh position={[0, -0.52, 0]}>
              <boxGeometry args={[n * GAP + 0.55, 0.1, 1.65]} />
              <meshBasicMaterial color="#7ad0ff" toneMapped={false} />
            </mesh>
          </>
        )}
        {chars.map((ch, i) => (
          <group key={i} position={[slot(i), 0, 0]}>
            <LetterPiece object={object} char={ch} index={i} blobSlot={blobSlot} typedCount={typedCount} />
          </group>
        ))}
      </group>
    )
  }

  // long: one continuous platform + letters along the top, colored by typing state
  return (
    <group>
      <LongMesh object={object} n={n} />
      {chars.map((ch, i) => {
        const mark = marks?.[i] ?? 0
        const isCaret = i === caret
        const color = mark === 2 ? "#ff4d4d" : mark === 1 ? "#ffffff" : isCaret ? "#5ff0d0" : object.ink
        return (
          <Text
            key={i}
            position={[slot(i), topY + 0.03, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.42}
            color={color}
            anchorX="center"
            anchorY="middle"
          >
            {ch}
          </Text>
        )
      })}
    </group>
  )
}
