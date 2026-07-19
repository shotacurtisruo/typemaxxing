import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Shape, ExtrudeGeometry, Vector3, type Group } from "three"
import { useGame } from "../game/store"
import { audio } from "../audio/AudioEngine"
import { charWorldPos } from "./sceneBus"

// A little embossed 5-point star, built once and shared by every coin.
function makeStar(outer: number, inner: number, points = 5): Shape {
  const s = new Shape()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  s.closePath()
  return s
}
const STAR_GEO = new ExtrudeGeometry(makeStar(0.15, 0.065), {
  depth: 0.02,
  bevelEnabled: true,
  bevelThickness: 0.012,
  bevelSize: 0.012,
  bevelSegments: 1,
})

const R = 0.85 // how close (world units) the cat must get to grab it
const R2 = R * R

/**
 * A rare gold coin floating above a platform. It spins + bobs while waiting, and
 * is only grabbed once the cat physically passes it (distance check vs the live
 * character position) — then it pops up, spins fast, and fades away.
 */
export default function Coin({ position, worldIndex, pan, collected }: { position: [number, number, number]; worldIndex: number; pan: number; collected: boolean }) {
  const grp = useRef<Group>(null)
  const spin = useRef(0)
  const out = useRef(0) // 0→1 collect animation
  const t = useRef(worldIndex * 1.7) // phase-offset the bob per coin
  const grabbed = useRef(false)
  const world = useMemo(() => new Vector3(), [])
  const collectCoin = useGame((s) => s.collectCoin)

  useFrame((_, dt) => {
    const g = grp.current
    if (!g) return
    t.current += dt
    spin.current += dt * (collected ? 15 : 1.9)
    g.rotation.y = spin.current

    if (collected) {
      out.current = Math.min(1, out.current + dt * 2.4)
      const o = out.current
      g.position.y = position[1] + o * 1.5 // fly up
      g.scale.setScalar(Math.max(0.001, 1 - o)) // shrink away
      if (g.visible && o >= 1) g.visible = false
      return
    }

    // idle bob
    g.position.y = position[1] + Math.sin(t.current * 2) * 0.12
    // collect only when the cat is physically next to the coin
    if (!grabbed.current) {
      g.getWorldPosition(world)
      const dx = world.x - charWorldPos.x
      const dz = world.z - charWorldPos.z
      if (dx * dx + dz * dz < R2) {
        grabbed.current = true
        collectCoin(worldIndex)
        audio.playCoin(pan)
      }
    }
  })

  return (
    <group ref={grp} position={position}>
      {/* disc body (faces point ±Z; spinning about Y flips it like a real coin) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.09, 30]} />
        <meshStandardMaterial color="#ffcf3a" metalness={0.75} roughness={0.28} emissive="#ffae1c" emissiveIntensity={0.35} />
      </mesh>
      {/* raised outer rim */}
      <mesh>
        <torusGeometry args={[0.3, 0.045, 12, 30]} />
        <meshStandardMaterial color="#ffe089" metalness={0.85} roughness={0.18} emissive="#ffbf3a" emissiveIntensity={0.3} />
      </mesh>
      {/* embossed stars on both faces */}
      <mesh geometry={STAR_GEO} position={[0, 0, 0.03]}>
        <meshStandardMaterial color="#e79a15" metalness={0.8} roughness={0.4} emissive="#c47c0e" emissiveIntensity={0.2} />
      </mesh>
      <mesh geometry={STAR_GEO} position={[0, 0, -0.03]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial color="#e79a15" metalness={0.8} roughness={0.4} emissive="#c47c0e" emissiveIntensity={0.2} />
      </mesh>
      {/* soft glow halo so it reads as a prize from a distance */}
      <mesh>
        <sphereGeometry args={[0.42, 16, 12]} />
        <meshBasicMaterial color="#ffe9a3" transparent opacity={0.12} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
