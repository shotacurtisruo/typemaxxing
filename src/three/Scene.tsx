import { Canvas, useFrame } from "@react-three/fiber"
import { Suspense, useRef, useState } from "react"
import { Vector3, Color, type Fog, type DirectionalLight } from "three"
import { useGame } from "../game/store"
import { objectFor, slotWorldPos, wordCenter } from "../game/config"
import { charWorldPos, shakeBus } from "./sceneBus"
import { detectTier, downgrade, qualityFromTier, motion, type Tier } from "../game/quality"
import Tower from "./Tower"
import Character from "./Character"
import Weather from "./Weather"

const CAM_LIFT = 3.2

/** Auto mode only: after 3 sustained sub-45fps seconds, drop one quality step.
 *  Only ever downgrades (latched), so it never oscillates between levels. */
function PerfGovernor({ tier, onDowngrade }: { tier: Tier; onDowngrade: () => void }) {
  const acc = useRef({ t: 0, frames: 0, bad: 0 })
  useFrame((_, dt) => {
    if (tier === "low") return
    const a = acc.current
    a.t += dt
    a.frames++
    if (a.t >= 1) {
      const fps = a.frames / a.t
      a.bad = fps < 45 ? a.bad + 1 : 0
      a.t = 0
      a.frames = 0
      if (a.bad >= 3) {
        a.bad = 0
        onDowngrade()
      }
    }
  })
  return null
}

/** Camera frames the current word steadily, easing to the next word on a jump. */
function ClimbCamera() {
  const camPos = useRef(new Vector3(9, 4, 9))
  const look = useRef(new Vector3())

  useFrame(({ camera, clock }, dt) => {
    const { baseWord, wi, ci, words, seed, angles } = useGame.getState()
    const W = baseWord + wi
    const len = words[wi]?.length ?? 1
    const angle = angles[wi] ?? 0

    // frame the word's center (stable while the blob runs across); nudge toward the blob
    const [cx, cy, cz] = wordCenter(angle, W)
    const [bx, , bz] = slotWorldPos(angle, W, Math.min(ci, len - 1), len)
    let fx = cx * 0.7 + bx * 0.3
    let fz = cz * 0.7 + bz * 0.3
    let top = cy + objectFor(W + seed).halfHeight
    let speed = 2.2

    // mid-fall/flight: the character is far from its word anchor — track the character
    const dx = charWorldPos.x - fx
    const dy = charWorldPos.y - top
    const dz2 = charWorldPos.z - fz
    if (Math.hypot(dx, dy, dz2) > 1.5) {
      fx = fx * 0.4 + charWorldPos.x * 0.6
      fz = fz * 0.4 + charWorldPos.z * 0.6
      top = top * 0.4 + charWorldPos.y * 0.6
      speed = 4.5
    }

    const clen = Math.hypot(cx, cz) || 1
    const ox = cx / clen
    const oz = cz / clen
    const dist = 8 + len * 0.45 // pull back for longer words

    // reduced motion: gentler, steadier framing (no fast fall-tracking lurches)
    if (motion.reduced) speed = Math.min(speed, 1.8)
    camPos.current.set(fx + ox * dist, top + CAM_LIFT, fz + oz * dist)
    camera.position.lerp(camPos.current, Math.min(1, dt * speed))

    // decaying landing shake — suppressed entirely under reduced motion
    shakeBus.v *= Math.exp(-5 * dt)
    if (!motion.reduced && shakeBus.v > 0.005) {
      const tt = clock.elapsedTime
      camera.position.x += Math.sin(tt * 91) * shakeBus.v * 0.12
      camera.position.y += Math.sin(tt * 73 + 1.7) * shakeBus.v * 0.1
    }

    look.current.set(fx, top + 0.2, fz)
    camera.lookAt(look.current)
  })
  return null
}

function Lighting() {
  const fogRef = useRef<Fog>(null)
  const dirRef = useRef<DirectionalLight>(null)
  const fogCol = useRef(new Color("#dbecfb"))
  const tintCol = useRef(new Color("#fff0c4"))
  const target = useRef(new Color())

  // ease fog + key-light tint toward the current weather (smooth crossfade)
  useFrame((_, dt) => {
    const w = useGame.getState().weather
    const k = Math.min(1, dt * 1.1)
    fogCol.current.lerp(target.current.set(w.fog), k)
    tintCol.current.lerp(target.current.set(w.tint), k)
    if (fogRef.current) fogRef.current.color.copy(fogCol.current)
    if (dirRef.current) dirRef.current.color.copy(tintCol.current)
  })

  return (
    <>
      <fog ref={fogRef} attach="fog" args={["#dbecfb", 14, 44]} />
      <ambientLight intensity={0.85} />
      <directionalLight ref={dirRef} position={[6, 12, 4]} intensity={1.2} castShadow />
      {/* soft colored rim lights keep the glossy ASMR specular pop */}
      <pointLight position={[-6, 3, -4]} intensity={26} color="#ffb0da" distance={30} />
      <pointLight position={[6, -2, 5]} intensity={24} color="#9fe6ff" distance={30} />
    </>
  )
}

export default function Scene() {
  const setting = useGame((s) => s.settings.quality)
  const [autoTier, setAutoTier] = useState<Tier>(detectTier)
  const tier: Tier = setting === "auto" ? autoTier : setting
  const q = qualityFromTier(tier)
  // under reduced motion, weather particles are killed outright (motion-heavy)
  const particleScale = motion.reduced ? 0 : q.particleScale

  return (
    <Canvas
      shadows={q.shadows}
      dpr={[1, q.dpr]}
      gl={{ alpha: true, antialias: tier !== "low" }}
      camera={{ position: [8, 4, 8], fov: 50, near: 0.1, far: 100 }}
    >
      <Lighting />
      <Weather particleScale={particleScale} />
      <Tower />
      <Suspense fallback={null}>
        <Character />
      </Suspense>
      <ClimbCamera />
      {setting === "auto" && <PerfGovernor tier={autoTier} onDowngrade={() => setAutoTier((t) => downgrade(t))} />}
    </Canvas>
  )
}
