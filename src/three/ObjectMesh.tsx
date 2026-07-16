import { RoundedBox, Text } from "@react-three/drei"
import type { ClimbObject } from "../game/config"
import { useGame } from "../game/store"
import KeycapModel, { CAPS } from "./KeycapModel"

/** Glossy amber honey — opaque so it always reads (no see-through-to-nothing). */
function HoneyGloss({ glow = 0, color = "#f0a81c" }: { glow?: number; color?: string }) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={0.09}
      metalness={0}
      clearcoat={1}
      clearcoatRoughness={0.05}
      sheen={0.5}
      sheenColor="#ffe6a0"
      emissive={color}
      emissiveIntensity={0.12 + glow}
    />
  )
}
/** Warm beeswax comb walls. */
function WaxMat({ glow = 0 }: { glow?: number }) {
  return (
    <meshPhysicalMaterial
      color="#cf9a37"
      roughness={0.55}
      clearcoat={0.35}
      clearcoatRoughness={0.35}
      emissive="#cf9a37"
      emissiveIntensity={glow * 0.5}
    />
  )
}

/**
 * Authentic, recognizable geometry for each climb object, centered at the
 * local origin (top face at +halfHeight). Shared by the game tower and the
 * object gallery so they always match.
 */

function Mat({ o, glow = 0, color }: { o: ClimbObject; glow?: number; color?: string }) {
  return (
    <meshPhysicalMaterial
      color={color ?? o.color}
      roughness={o.roughness}
      metalness={o.metalness}
      transmission={o.transmission}
      thickness={0.6}
      ior={o.shape === "ice" || o.shape === "bubble" ? 1.31 : 1.3}
      clearcoat={o.transmission > 0 || o.shape === "chocolate" ? 1 : 0.35}
      clearcoatRoughness={0.14}
      emissive={glow > 0 ? (color ?? o.color) : "#000000"}
      emissiveIntensity={glow}
    />
  )
}

/** Tiny translucent air bubble trapped inside a translucent body. */
function InnerBubble({ pos, r }: { pos: [number, number, number]; r: number }) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[r, 10, 8]} />
      <meshStandardMaterial color="#ffffff" transparent opacity={0.5} roughness={0.2} depthWrite={false} />
    </mesh>
  )
}

/** Deterministic pseudo-random in [0,1) from a number — stable across renders. */
function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function Geometry({ object, glow, seed = 0 }: { object: ClimbObject; glow: number; seed?: number }) {
  const keycap = useGame((s) => s.keycap)
  const o = object
  switch (o.shape) {
    case "keycap": {
      // render the player's selected keycap profile (MT3 / XDA)
      const cap = CAPS.find((c) => c.key === keycap) ?? CAPS[0]
      return <KeycapModel cap={cap} />
    }

    case "chocolate": {
      // warm tempered bar: thin rimmed slab + tight grid of beveled squares
      const cols = [-0.53, 0, 0.53]
      const rows = [-0.25, 0.25]
      return (
        <group>
          <RoundedBox args={[1.68, 0.18, 1.12]} radius={0.04} smoothness={3} position={[0, -0.13, 0]}>
            <Mat o={o} glow={glow} color="#472a10" />
          </RoundedBox>
          {cols.map((x) =>
            rows.map((z) => (
              <RoundedBox key={`${x}-${z}`} args={[0.47, 0.2, 0.44]} radius={0.05} smoothness={3} position={[x, 0.11, z]}>
                <Mat o={o} glow={glow} />
              </RoundedBox>
            ))
          )}
        </group>
      )
    }

    case "jelly":
      // slumped translucent gelatin cube with trapped micro-bubbles
      return (
        <group>
          <RoundedBox args={[1.08, 0.36, 1.08]} radius={0.16} smoothness={4} position={[0, -0.28, 0]}>
            <Mat o={o} glow={glow} />
          </RoundedBox>
          <RoundedBox args={[0.96, 0.88, 0.96]} radius={0.2} smoothness={5} position={[0, 0.02, 0]}>
            <Mat o={o} glow={glow} />
          </RoundedBox>
          <InnerBubble pos={[-0.18, 0.08, 0.12]} r={0.045} />
          <InnerBubble pos={[0.16, -0.1, -0.06]} r={0.035} />
          <InnerBubble pos={[0.04, 0.24, 0.02]} r={0.028} />
        </group>
      )

    case "butter":
      // a cut stick: pale outer + deeper-yellow exposed cut face
      return (
        <group>
          <RoundedBox args={[1.56, 0.5, 0.72]} radius={0.05} smoothness={3} position={[-0.07, 0, 0]}>
            <Mat o={o} glow={glow} />
          </RoundedBox>
          <RoundedBox args={[0.14, 0.46, 0.68]} radius={0.04} smoothness={3} position={[0.78, 0, 0]}>
            <Mat o={o} glow={glow} color="#e9bd41" />
          </RoundedBox>
        </group>
      )

    case "marshmallow":
      // puffy capsule: rounded puffed ends, squashed soft
      return (
        <mesh scale={[1, 0.72, 1]}>
          <capsuleGeometry args={[0.5, 0.4, 8, 24]} />
          <Mat o={o} glow={glow} />
        </mesh>
      )

    case "bubble":
      // soap film: alpha-transparent shell (blends with the sky) + thin-film iridescent sheen
      return (
        <mesh>
          <sphereGeometry args={[0.46, 48, 32]} />
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
            emissive={glow > 0 ? "#9fd4ff" : "#000000"}
            emissiveIntensity={glow * 0.6}
          />
        </mesh>
      )

    case "ice":
      // glassy blue cube (alpha, so the sky shows through) + cloudy frozen core + hairline cracks
      return (
        <group>
          <RoundedBox args={[0.9, 0.84, 0.9]} radius={0.08} smoothness={4}>
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
              emissive={glow > 0 ? "#7fd0ff" : "#000000"}
              emissiveIntensity={glow * 0.6}
            />
          </RoundedBox>
          <RoundedBox args={[0.42, 0.4, 0.42]} radius={0.12} smoothness={3}>
            <meshStandardMaterial color="#ffffff" transparent opacity={0.55} roughness={1} depthWrite={false} />
          </RoundedBox>
          <mesh rotation={[0.4, 0.5, 0.25]} position={[-0.05, 0.12, 0.05]}>
            <boxGeometry args={[0.68, 0.012, 0.012]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.65} />
          </mesh>
          <mesh rotation={[-0.3, -0.7, 0.55]} position={[0.1, -0.08, -0.04]}>
            <boxGeometry args={[0.5, 0.01, 0.01]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
          </mesh>
        </group>
      )

    case "honey": {
      // comb + drizzle (option D): a wax comb cell with a recessed honey pool,
      // a glossy honey layer overflowing the rim (the walkable top ~+0.28), a
      // drizzle ribbon weaving across, and a drip off the front. Cells tile into
      // a continuous oozing comb.
      // big, wide hexagonal comb cell + honey randomly pooled/oozing on top
      // (per-cell random, seeded so it doesn't re-roll on re-render).
      const oozeCount = 2 + Math.floor(hash(seed * 1.7 + 0.5) * 3) // 2-4 pools
      const ooze = Array.from({ length: oozeCount }, (_, k) => {
        const a = hash(seed * 3.1 + k * 5.3) * Math.PI * 2
        const rad = hash(seed * 2.3 + k * 7.1) * 0.5
        return {
          x: Math.cos(a) * rad,
          z: Math.sin(a) * rad,
          r: 0.2 + hash(seed * 4.7 + k * 2.9) * 0.28,
          y: 0.26 + hash(seed * 5.9 + k) * 0.05,
        }
      })
      const hasDrip = hash(seed * 9.1 + 0.3) > 0.45
      const dripA = hash(seed * 6.7) * Math.PI * 2
      return (
        <group>
          {/* big wide hexagonal wax comb cell — flats face neighbors (Y-rot 30°),
              so a word tiles into a chunky honeycomb. Wax rim = walkable top (~+0.28). */}
          <mesh position={[0, 0.0, 0]} rotation={[0, Math.PI / 6, 0]}>
            <cylinderGeometry args={[0.82, 0.82, 0.56, 6]} />
            <WaxMat glow={glow} />
          </mesh>
          {/* thick raised rim so the hex wall reads boldly */}
          <mesh position={[0, 0.2, 0]} rotation={[0, Math.PI / 6, 0]}>
            <cylinderGeometry args={[0.72, 0.78, 0.24, 6]} />
            <WaxMat glow={glow} />
          </mesh>
          {/* recessed glossy honey pool filling the cell, just below the rim */}
          <mesh position={[0, 0.18, 0]} rotation={[0, Math.PI / 6, 0]}>
            <cylinderGeometry args={[0.64, 0.64, 0.2, 6]} />
            <HoneyGloss glow={glow} />
          </mesh>
          {/* honey randomly pooled/oozing on top — irregular glossy blobs */}
          {ooze.map((b, k) => (
            <mesh key={k} position={[b.x, b.y, b.z]} scale={[1, 0.42, 1]}>
              <sphereGeometry args={[b.r, 18, 14]} />
              <HoneyGloss glow={glow} />
            </mesh>
          ))}
          {/* an occasional drip oozing over a random edge */}
          {hasDrip && (
            <group position={[Math.cos(dripA) * 0.6, 0.05, Math.sin(dripA) * 0.6]}>
              <mesh position={[0, -0.18, 0]} scale={[1, 2.3, 1]}>
                <sphereGeometry args={[0.08, 14, 10]} />
                <HoneyGloss glow={glow} />
              </mesh>
              <mesh position={[0, -0.4, 0]}>
                <sphereGeometry args={[0.11, 14, 10]} />
                <HoneyGloss glow={glow} />
              </mesh>
            </group>
          )}
        </group>
      )
    }

    case "slime":
      // gooey squashed blob: drips + trapped bubbles (crunchy-slime look)
      return (
        <group>
          <mesh scale={[1, 0.78, 1]}>
            <icosahedronGeometry args={[0.58, 2]} />
            <Mat o={o} glow={glow} />
          </mesh>
          <mesh position={[0.42, -0.28, 0.1]} scale={[0.5, 0.6, 0.5]}>
            <icosahedronGeometry args={[0.3, 2]} />
            <Mat o={o} glow={glow} />
          </mesh>
          <mesh position={[-0.36, -0.3, -0.06]} scale={[0.4, 0.75, 0.4]}>
            <icosahedronGeometry args={[0.26, 2]} />
            <Mat o={o} glow={glow} />
          </mesh>
          <InnerBubble pos={[-0.12, 0.08, 0.16]} r={0.05} />
          <InnerBubble pos={[0.16, -0.04, -0.1]} r={0.035} />
        </group>
      )
  }
}

interface Props {
  object: ClimbObject
  char?: string
  glow?: number
  showLetter?: boolean
  seed?: number // stable per-cell variety (e.g. letter index) — keeps random layouts from re-rolling
}

export default function ObjectMesh({ object, char, glow = 0, showLetter = true, seed = 0 }: Props) {
  const keycap = useGame((s) => s.keycap)
  const isSpace = char === " "
  const ink =
    object.shape === "keycap" ? CAPS.find((c) => c.key === keycap)?.ink ?? object.ink : object.ink
  return (
    <group scale={isSpace ? [1.6, 1, 1] : [1, 1, 1]}>
      <Geometry object={object} glow={glow} seed={seed} />
      {showLetter && char && !isSpace && (
        <Text
          position={[0, object.halfHeight + 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={object.shape === "butter" ? 0.4 : 0.5}
          color={ink}
          anchorX="center"
          anchorY="middle"
        >
          {char}
        </Text>
      )}
    </group>
  )
}
