import { RoundedBox } from "@react-three/drei"

export interface Cap {
  key: string
  name: string
  group: "thocky" | "creamy"
  tone: string
  build: "mt3" | "sa" | "oem" | "xda" | "dsa" | "pudding"
  color: string
  ink: string
  finish: "pbt" | "abs"
}

export const CAPS: Cap[] = [
  { key: "mt3", name: "MT3", group: "thocky", tone: "deep scooped thock", build: "mt3", color: "#3c4450", ink: "#e6e9ef", finish: "pbt" },
  { key: "sa", name: "SA", group: "thocky", tone: "tall, round, resonant", build: "sa", color: "#efe6cf", ink: "#5a4632", finish: "abs" },
  { key: "oem", name: "OEM", group: "thocky", tone: "full clack-thock", build: "oem", color: "#4a505c", ink: "#dfe3ea", finish: "pbt" },
  { key: "xda", name: "XDA", group: "creamy", tone: "poppy & creamy", build: "xda", color: "#bfe6d0", ink: "#2e5a45", finish: "pbt" },
  { key: "dsa", name: "DSA", group: "creamy", tone: "light soft clack", build: "dsa", color: "#e7d7ec", ink: "#5a3a63", finish: "pbt" },
  { key: "pudding", name: "Pudding", group: "creamy", tone: "bright creamy shine", build: "pudding", color: "#2b2b30", ink: "#d8d8e0", finish: "abs" },
]

function Body({ cap, args, radius, pos, color, scoop = false }: { cap: Cap; args: [number, number, number]; radius: number; pos: [number, number, number]; color?: string; scoop?: boolean }) {
  return (
    <RoundedBox args={args} radius={radius} smoothness={4} position={pos}>
      <meshPhysicalMaterial
        color={color ?? cap.color}
        roughness={cap.finish === "pbt" ? 0.62 : 0.32}
        metalness={0}
        clearcoat={cap.finish === "abs" ? 0.6 : 0.15}
        clearcoatRoughness={0.3}
        transmission={scoop ? 0 : 0}
      />
    </RoundedBox>
  )
}

/** A keycap profile, center-anchored at the origin. */
export default function KeycapModel({ cap }: { cap: Cap }) {
  switch (cap.build) {
    case "oem":
      return (
        <group>
          <Body cap={cap} args={[1.14, 0.4, 1.14]} radius={0.05} pos={[0, -0.12, 0]} />
          <group rotation={[-0.06, 0, 0]}>
            <Body cap={cap} args={[0.94, 0.26, 0.98]} radius={0.08} pos={[0, 0.19, 0]} />
          </group>
        </group>
      )

    case "sa":
      return (
        <group>
          <Body cap={cap} args={[1.14, 0.36, 1.14]} radius={0.06} pos={[0, -0.16, 0]} />
          {/* rounded spherical top */}
          <mesh position={[0, 0.14, 0]} scale={[0.98, 0.62, 1.0]}>
            <sphereGeometry args={[0.58, 32, 24]} />
            <meshPhysicalMaterial color={cap.color} roughness={0.34} clearcoat={0.6} clearcoatRoughness={0.3} />
          </mesh>
        </group>
      )

    case "mt3":
      // centered so top face sits near +0.3 (see config keycap halfHeight)
      return (
        <group>
          <Body cap={cap} args={[1.16, 0.3, 1.16]} radius={0.05} pos={[0, -0.15, 0]} />
          {/* tall walls form the deep dish rim */}
          <Body cap={cap} args={[1.02, 0.36, 1.04]} radius={0.06} pos={[0, 0.11, 0]} />
          {/* recessed darker scoop */}
          <Body cap={cap} args={[0.76, 0.14, 0.82]} radius={0.1} pos={[0, 0.2, 0]} color="#2a313b" scoop />
        </group>
      )

    case "xda":
      return (
        <group>
          <Body cap={cap} args={[1.22, 0.52, 1.22]} radius={0.14} pos={[0, -0.04, 0]} />
          {/* subtle domed top */}
          <mesh position={[0, 0.22, 0]} scale={[0.92, 0.18, 0.92]}>
            <sphereGeometry args={[0.62, 32, 20]} />
            <meshPhysicalMaterial color={cap.color} roughness={0.6} clearcoat={0.15} />
          </mesh>
        </group>
      )

    case "dsa":
      return (
        <group>
          <Body cap={cap} args={[1.16, 0.34, 1.16]} radius={0.12} pos={[0, -0.02, 0]} />
          <mesh position={[0, 0.16, 0]} scale={[0.82, 0.13, 0.82]}>
            <sphereGeometry args={[0.6, 28, 18]} />
            <meshPhysicalMaterial color={cap.color} roughness={0.62} clearcoat={0.15} />
          </mesh>
        </group>
      )

    case "pudding":
      return (
        <group>
          {/* translucent shine-through base */}
          <RoundedBox args={[1.18, 0.3, 1.18]} radius={0.05} smoothness={4} position={[0, -0.13, 0]}>
            <meshPhysicalMaterial color="#eaf4ff" roughness={0.25} transmission={0.55} thickness={0.8} ior={1.3} emissive="#6fc8ff" emissiveIntensity={0.6} clearcoat={1} />
          </RoundedBox>
          {/* opaque legend top */}
          <group rotation={[-0.05, 0, 0]}>
            <Body cap={cap} args={[0.96, 0.26, 1.0]} radius={0.08} pos={[0, 0.16, 0]} />
          </group>
        </group>
      )
  }
}
