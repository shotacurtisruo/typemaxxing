import { RoundedBox, Text } from "@react-three/drei"
import type { ClimbObject } from "../game/config"
import { useGame } from "../game/store"
import KeycapModel, { CAPS } from "./KeycapModel"

/**
 * Authentic, recognizable geometry for each climb object, centered at the
 * local origin (top face at +halfHeight). Shared by the game tower and the
 * object gallery so they always match.
 */

function Mat({ o, glow = 0 }: { o: ClimbObject; glow?: number }) {
  return (
    <meshPhysicalMaterial
      color={o.color}
      roughness={o.roughness}
      metalness={o.metalness}
      transmission={o.transmission}
      thickness={0.6}
      ior={o.shape === "ice" || o.shape === "bubble" ? 1.31 : 1.3}
      clearcoat={o.transmission > 0 || o.shape === "chocolate" ? 1 : 0.35}
      clearcoatRoughness={0.14}
      emissive={glow > 0 ? o.color : "#000000"}
      emissiveIntensity={glow}
    />
  )
}

function Geometry({ object, glow }: { object: ClimbObject; glow: number }) {
  const keycap = useGame((s) => s.keycap)
  const o = object
  switch (o.shape) {
    case "keycap": {
      // render the player's selected keycap profile (MT3 / XDA)
      const cap = CAPS.find((c) => c.key === keycap) ?? CAPS[0]
      return <KeycapModel cap={cap} />
    }

    case "chocolate": {
      // thin slab + a grid of molded squares with grooves between
      const cols = [-0.5, 0, 0.5]
      const rows = [-0.26, 0.26]
      return (
        <group>
          <RoundedBox args={[1.62, 0.2, 1.06]} radius={0.03} smoothness={3} position={[0, -0.12, 0]}>
            <Mat o={o} glow={glow} />
          </RoundedBox>
          {cols.map((x) =>
            rows.map((z) => (
              <mesh key={`${x}-${z}`} position={[x, 0.12, z]}>
                <boxGeometry args={[0.42, 0.2, 0.42]} />
                <Mat o={o} glow={glow} />
              </mesh>
            ))
          )}
        </group>
      )
    }

    case "jelly":
      // pillowy translucent wobble-cube
      return (
        <RoundedBox args={[1.0, 0.92, 1.0]} radius={0.4} smoothness={5}>
          <Mat o={o} glow={glow} />
        </RoundedBox>
      )

    case "butter":
      // a cut stick of butter — crisp edges
      return (
        <RoundedBox args={[1.7, 0.5, 0.72]} radius={0.05} smoothness={3}>
          <Mat o={o} glow={glow} />
        </RoundedBox>
      )

    case "marshmallow":
      // short fat cylinder
      return (
        <mesh>
          <cylinderGeometry args={[0.56, 0.56, 0.88, 28]} />
          <Mat o={o} glow={glow} />
        </mesh>
      )

    case "bubble":
      // a soap bubble — thin glassy sphere
      return (
        <mesh>
          <sphereGeometry args={[0.46, 40, 28]} />
          <Mat o={o} glow={glow} />
        </mesh>
      )

    case "ice":
      // beveled glassy ice cube
      return (
        <RoundedBox args={[0.9, 0.84, 0.9]} radius={0.07} smoothness={4}>
          <Mat o={o} glow={glow} />
        </RoundedBox>
      )

    case "honey":
      // honeycomb hexagonal cell
      return (
        <mesh rotation={[0, Math.PI / 6, 0]}>
          <cylinderGeometry args={[0.72, 0.72, 0.56, 6]} />
          <Mat o={o} glow={glow} />
        </mesh>
      )

    case "slime":
      // gooey squashed blob with a drip
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
        </group>
      )
  }
}

interface Props {
  object: ClimbObject
  char?: string
  glow?: number
  showLetter?: boolean
}

export default function ObjectMesh({ object, char, glow = 0, showLetter = true }: Props) {
  const keycap = useGame((s) => s.keycap)
  const isSpace = char === " "
  const ink =
    object.shape === "keycap" ? CAPS.find((c) => c.key === keycap)?.ink ?? object.ink : object.ink
  return (
    <group scale={isSpace ? [1.6, 1, 1] : [1, 1, 1]}>
      <Geometry object={object} glow={glow} />
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
