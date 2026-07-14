import { Canvas, useFrame } from "@react-three/fiber"
import { useRef } from "react"
import { Vector3 } from "three"
import { useGame } from "../game/store"
import { objectFor, slotWorldPos, wordCenter } from "../game/config"
import Tower from "./Tower"
import Blob from "./Blob"
import Weather from "./Weather"

const CAM_LIFT = 3.2

/** Camera frames the current word steadily, easing to the next word on a jump. */
function ClimbCamera() {
  const camPos = useRef(new Vector3(9, 4, 9))
  const look = useRef(new Vector3())

  useFrame(({ camera }, dt) => {
    const { baseWord, wi, ci, words } = useGame.getState()
    const W = baseWord + wi
    const len = words[wi]?.length ?? 1

    // frame the word's center (stable while the blob runs across); nudge toward the blob
    const [cx, cy, cz] = wordCenter(W)
    const [bx, , bz] = slotWorldPos(W, Math.min(ci, len - 1), len)
    const fx = cx * 0.7 + bx * 0.3
    const fz = cz * 0.7 + bz * 0.3
    const top = cy + objectFor(W).halfHeight

    const clen = Math.hypot(cx, cz) || 1
    const ox = cx / clen
    const oz = cz / clen
    const dist = 8 + len * 0.45 // pull back for longer words

    camPos.current.set(fx + ox * dist, top + CAM_LIFT, fz + oz * dist)
    camera.position.lerp(camPos.current, Math.min(1, dt * 2.2))

    look.current.set(fx, top + 0.2, fz)
    camera.lookAt(look.current)
  })
  return null
}

function Lighting() {
  const tint = useGame((s) => s.weather.tint)
  const fog = useGame((s) => s.weather.fog)
  return (
    <>
      <fog attach="fog" args={[fog, 14, 44]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 12, 4]} intensity={1.2} color={tint} castShadow />
      {/* soft colored rim lights keep the glossy ASMR specular pop */}
      <pointLight position={[-6, 3, -4]} intensity={26} color="#ffb0da" distance={30} />
      <pointLight position={[6, -2, 5]} intensity={24} color="#9fe6ff" distance={30} />
    </>
  )
}

export default function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [8, 4, 8], fov: 50, near: 0.1, far: 100 }}
    >
      <Lighting />
      <Weather />
      <Tower />
      <Blob />
      <ClimbCamera />
    </Canvas>
  )
}
