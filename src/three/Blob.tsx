import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Vector3, type Group, type Mesh } from "three"
import { useGame } from "../game/store"
import { objectFor, slotWorldPos } from "../game/config"

const BLOB_R = 0.42

/** The gel blob character — a cute translucent creature that runs the words. */
export default function Blob() {
  const group = useRef<Group>(null)
  const body = useRef<Mesh>(null)
  const face = useRef<Group>(null)
  const target = useRef(new Vector3())
  const prev = useRef(new Vector3())

  useFrame(({ camera, clock }, dt) => {
    const g = group.current
    const b = body.current
    if (!g || !b) return
    const { baseWord, wi, ci, words } = useGame.getState()
    const W = baseWord + wi
    const len = words[wi]?.length ?? 1
    const slot = Math.min(ci, len - 1) // stay on the last key, never float past the end
    const [tx, ty, tz] = slotWorldPos(W, slot, len)
    const top = objectFor(W).halfHeight + BLOB_R
    target.current.set(tx, ty + top, tz)

    prev.current.copy(g.position)
    g.position.lerp(target.current, Math.min(1, dt * 9))

    // squash-stretch from travel + gentle idle breathing
    const speed = g.position.distanceTo(prev.current) / Math.max(dt, 1e-3)
    const s = Math.min(0.4, speed * 0.05)
    const breathe = Math.sin(clock.elapsedTime * 3) * 0.03
    b.scale.set(1 - s * 0.6 + breathe, 1 + s - breathe, 1 - s * 0.6 + breathe)

    if (face.current) face.current.lookAt(camera.position) // face always toward the viewer
  })

  return (
    <group ref={group}>
      <mesh ref={body} castShadow>
        <icosahedronGeometry args={[BLOB_R, 6]} />
        <meshPhysicalMaterial
          color="#5ff0d0"
          roughness={0.04}
          transmission={0.5}
          thickness={1.1}
          ior={1.35}
          clearcoat={1}
          clearcoatRoughness={0.08}
          emissive="#0e7d68"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* face — billboards to camera */}
      <group ref={face}>
        {[-0.15, 0.15].map((x) => (
          <group key={x} position={[x, 0.07, 0.33]}>
            <mesh>
              <sphereGeometry args={[0.1, 20, 16]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, 0.07]}>
              <sphereGeometry args={[0.055, 16, 12]} />
              <meshStandardMaterial color="#153039" roughness={0.2} />
            </mesh>
            <mesh position={[0.025, 0.03, 0.11]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        ))}
        {/* blush cheeks */}
        {[-0.25, 0.25].map((x) => (
          <mesh key={x} position={[x, -0.06, 0.29]}>
            <sphereGeometry args={[0.06, 12, 10]} />
            <meshBasicMaterial color="#ff9ecb" transparent opacity={0.5} />
          </mesh>
        ))}
        {/* smile */}
        <mesh position={[0, -0.09, 0.33]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.07, 0.017, 10, 20, Math.PI]} />
          <meshStandardMaterial color="#153039" roughness={0.3} />
        </mesh>
        {/* top shine */}
        <mesh position={[-0.13, 0.22, 0.14]}>
          <sphereGeometry args={[0.075, 12, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
        </mesh>
      </group>
    </group>
  )
}
