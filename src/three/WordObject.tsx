import { useEffect, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { RoundedBox, Text } from "@react-three/drei"
import type { Group } from "three"
import { GAP, type ClimbObject } from "../game/config"
import ObjectMesh from "./ObjectMesh"

export type Variant = "segmented" | "long"
export { GAP }

/** One letter-piece in a segmented word: glows when it's next, squashes on landing. */
function LetterPiece({ object, char, index, activeIndex }: { object: ClimbObject; char: string; index: number; activeIndex: number }) {
  const g = useRef<Group>(null)
  const impact = useRef(0)
  const wasTyped = useRef(false)
  const typed = index < activeIndex
  const isNext = index === activeIndex
  const glow = isNext ? 0.4 : typed ? 0.06 : 0

  useEffect(() => {
    if (typed && !wasTyped.current) impact.current = 1
    wasTyped.current = typed
  }, [typed])

  useFrame((_, dt) => {
    if (!g.current) return
    impact.current = Math.max(0, impact.current - dt * 4)
    const sq = impact.current
    g.current.scale.set(1 + sq * 0.16, 1 - sq * 0.28, 1 + sq * 0.16)
    g.current.position.y = isNext ? Math.sin(performance.now() / 300) * 0.03 : 0
  })

  return (
    <group ref={g}>
      <ObjectMesh object={object} char={char} glow={glow} />
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
  activeIndex?: number // letter the blob is on (game only); -1 = inactive word
}

/** A whole word rendered as a single climb object. */
export default function WordObject({ object, word, variant, activeIndex = -1 }: Props) {
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
            <LetterPiece object={object} char={ch} index={i} activeIndex={activeIndex} />
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
