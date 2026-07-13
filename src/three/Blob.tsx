import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Vector3, type Mesh } from "three"
import { useGame } from "../game/store"
import { positionFor } from "../game/config"

const CAP_TOP = 0.25
const BLOB_R = 0.42

/** The customizable gel blob. Lerps onto the last-climbed keycap with squash-stretch. */
export default function Blob() {
  const mesh = useRef<Mesh>(null)
  const target = useRef(new Vector3())
  const prev = useRef(new Vector3())

  useFrame((_, dt) => {
    if (!mesh.current) return
    const { baseOffset, typed } = useGame.getState()
    const landed = baseOffset + typed - 1 // -1 before first keystroke -> base

    const [tx, ty, tz] = positionFor(landed)
    target.current.set(tx, ty + CAP_TOP + BLOB_R, tz)

    prev.current.copy(mesh.current.position)
    mesh.current.position.lerp(target.current, Math.min(1, dt * 9))

    // squash-stretch from travel speed
    const speed = mesh.current.position.distanceTo(prev.current) / Math.max(dt, 1e-3)
    const s = Math.min(0.35, speed * 0.05)
    mesh.current.scale.set(1 - s * 0.6, 1 + s, 1 - s * 0.6)
    mesh.current.rotation.y += dt * 0.6
  })

  return (
    <mesh ref={mesh} castShadow>
      <icosahedronGeometry args={[BLOB_R, 6]} />
      <meshPhysicalMaterial
        color="#5ff0d0"
        roughness={0.05}
        transmission={0.55}
        thickness={1}
        ior={1.35}
        clearcoat={1}
        clearcoatRoughness={0.1}
        emissive="#0e5f52"
        emissiveIntensity={0.15}
      />
    </mesh>
  )
}
