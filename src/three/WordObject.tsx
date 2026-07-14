import { useEffect, useRef, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { RoundedBox, Text } from "@react-three/drei"
import type { Group } from "three"
import { GAP, type ClimbObject } from "../game/config"
import ObjectMesh from "./ObjectMesh"

export type Variant = "segmented" | "long"
export { GAP }

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
  const typed = index < typedCount
  const hasBlob = index === blobSlot
  const glow = hasBlob ? 0.5 : typed ? 0.06 : 0
  const style = landingFor(object.shape)

  useEffect(() => {
    if (hasBlob && !wasBlob.current) impact.current = 1 // blob just landed here
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
      {style === "crack" && (
        <CrackLines groupRef={crack} color={object.shape === "ice" ? "#eaffff" : "#1c0f07"} y={object.halfHeight + 0.02} />
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

/** One continuous elongated piece spanning the whole word. */
function LongMesh({ object: o, n }: { object: ClimbObject; n: number }) {
  const L = Math.max(n, 1) * GAP
  switch (o.shape) {
    case "keycap": // a long key (spacebar-like)
      return (
        <group>
          <RoundedBox args={[L, 0.3, 1.16]} radius={0.05} smoothness={4} position={[0, -0.15, 0]}>
            <LMat o={o} color="#3c4450" />
          </RoundedBox>
          <RoundedBox args={[L - 0.2, 0.34, 1.0]} radius={0.08} smoothness={4} position={[0, 0.1, 0]}>
            <LMat o={o} color="#3c4450" />
          </RoundedBox>
        </group>
      )
    case "chocolate": {
      const cols = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * GAP)
      return (
        <group>
          <RoundedBox args={[L + 0.1, 0.2, 1.06]} radius={0.03} smoothness={3} position={[0, -0.12, 0]}>
            <LMat o={o} />
          </RoundedBox>
          {cols.map((x, i) =>
            [-0.26, 0.26].map((z, j) => (
              <mesh key={`${i}-${j}`} position={[x, 0.12, z]}>
                <boxGeometry args={[GAP * 0.7, 0.2, 0.42]} />
                <LMat o={o} />
              </mesh>
            ))
          )}
        </group>
      )
    }
    case "jelly":
      return (
        <RoundedBox args={[L, 0.9, 1.0]} radius={0.42} smoothness={5}>
          <LMat o={o} />
        </RoundedBox>
      )
    case "butter":
      return (
        <RoundedBox args={[L, 0.5, 0.72]} radius={0.05} smoothness={3}>
          <LMat o={o} />
        </RoundedBox>
      )
    case "marshmallow":
      return (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.46, 0.46, L, 28]} />
          <LMat o={o} />
        </mesh>
      )
    case "bubble":
      return (
        <mesh scale={[L / 0.92, 1, 1]}>
          <sphereGeometry args={[0.46, 40, 28]} />
          <LMat o={o} />
        </mesh>
      )
    case "ice":
      return (
        <RoundedBox args={[L, 0.8, 0.9]} radius={0.07} smoothness={4}>
          <LMat o={o} />
        </RoundedBox>
      )
    case "honey":
      return (
        <mesh rotation={[Math.PI / 2, 0, Math.PI / 6]}>
          <cylinderGeometry args={[0.5, 0.5, L, 6]} />
          <LMat o={o} />
        </mesh>
      )
    case "slime":
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
        </group>
      )
  }
}

interface Props {
  object: ClimbObject
  word: string
  variant: Variant
  blobSlot?: number // letter the blob is on (current word only); -1 otherwise
  typedCount?: number // letters already typed in this word
}

/** A whole word rendered as a single climb object. */
export default function WordObject({ object, word, variant, blobSlot = -1, typedCount = 0 }: Props) {
  const chars = word.split("")
  const n = chars.length
  const slot = (i: number) => (i - (n - 1) / 2) * GAP
  const topY = object.halfHeight

  if (variant === "segmented") {
    return (
      <group>
        {/* keyboard base plate under the keys */}
        {object.shape === "keycap" && (
          <RoundedBox args={[n * GAP + 0.4, 0.24, 1.5]} radius={0.1} smoothness={4} position={[0, -0.34, 0]}>
            <meshPhysicalMaterial color="#1c2029" roughness={0.5} clearcoat={0.3} />
          </RoundedBox>
        )}
        {chars.map((ch, i) => (
          <group key={i} position={[slot(i), 0, 0]}>
            <LetterPiece object={object} char={ch} index={i} blobSlot={blobSlot} typedCount={typedCount} />
          </group>
        ))}
      </group>
    )
  }

  // long: one piece + letters along the top
  return (
    <group>
      <LongMesh object={object} n={n} />
      {chars.map((ch, i) => (
        <Text
          key={i}
          position={[slot(i), topY + 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.42}
          color={object.ink}
          anchorX="center"
          anchorY="middle"
        >
          {ch}
        </Text>
      ))}
    </group>
  )
}
