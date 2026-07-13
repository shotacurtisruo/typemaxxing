import { Canvas, useFrame } from "@react-three/fiber"
import { useRef } from "react"
import { Vector3 } from "three"
import { useGame } from "../game/store"
import { positionFor, RADIUS } from "../game/config"
import Tower from "./Tower"
import Blob from "./Blob"

const CAM_DIST = 6
const CAM_LIFT = 3.2

/** Camera rides just outside the spiral, rising and orbiting with the climb. */
function ClimbCamera() {
  const camPos = useRef(new Vector3(8, 4, 8))
  const look = useRef(new Vector3())

  useFrame(({ camera }, dt) => {
    const { baseOffset, typed } = useGame.getState()
    const landed = baseOffset + typed - 1
    const [bx, by, bz] = positionFor(landed)

    // outward direction from the central axis
    const len = Math.hypot(bx, bz) || 1
    const ox = bx / len
    const oz = bz / len

    camPos.current.set(bx + ox * CAM_DIST, by + CAM_LIFT, bz + oz * CAM_DIST)
    camera.position.lerp(camPos.current, Math.min(1, dt * 2.5))

    look.current.set(bx * 0.15, by + 0.4, bz * 0.15)
    camera.lookAt(look.current)
  })
  return null
}

export default function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [8, 4, 8], fov: 50, near: 0.1, far: 100 }}
    >
      <fog attach="fog" args={["#0e0b24", 12, 34]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 12, 4]} intensity={1.1} castShadow />
      {/* colored rim lights give the glossy caps their ASMR specular pop */}
      <pointLight position={[-6, 3, -4]} intensity={40} color="#ff8fd0" distance={30} />
      <pointLight position={[6, -2, 5]} intensity={35} color="#66e6ff" distance={30} />
      <pointLight position={[0, 8, -6]} intensity={30} color="#c3a0ff" distance={30} />
      {/* faint central pillar for depth */}
      <mesh position={[0, RADIUS * 2, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 200, 12]} />
        <meshBasicMaterial color="#2a2350" transparent opacity={0.25} />
      </mesh>
      <Tower />
      <Blob />
      <ClimbCamera />
    </Canvas>
  )
}
