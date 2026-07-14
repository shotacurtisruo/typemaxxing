import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { useGame } from "../game/store"
import type { Particle } from "../game/config"

const SPREAD = 12
const BAND = 28 // vertical range recycled around the camera

const CFG: Record<Particle, { count: number; color: string; size: number; vy: number; sway: number; opacity: number; additive?: boolean }> = {
  rain: { count: 600, color: "#c2d6ef", size: 0.05, vy: -16, sway: 0.15, opacity: 0.5 },
  snow: { count: 420, color: "#ffffff", size: 0.13, vy: -1.6, sway: 0.9, opacity: 0.92 },
  sparkle: { count: 170, color: "#fff0bf", size: 0.15, vy: 0.5, sway: 0.5, opacity: 0.9, additive: true },
  petal: { count: 240, color: "#ffbdd8", size: 0.16, vy: -1.3, sway: 1.3, opacity: 0.85 },
}

function Particles({ type }: { type: Particle }) {
  const cfg = CFG[type]
  const { positions, phases } = useMemo(() => {
    const positions = new Float32Array(cfg.count * 3)
    const phases = new Float32Array(cfg.count)
    for (let i = 0; i < cfg.count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * SPREAD
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * (BAND / 2)
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * SPREAD
      phases[i] = Math.random() * Math.PI * 2
    }
    return { positions, phases }
  }, [cfg.count])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  useFrame((state, dt) => {
    const camY = state.camera.position.y
    const t = state.clock.elapsedTime
    const arr = geom.attributes.position.array as Float32Array
    const top = camY + BAND / 2
    const bot = camY - BAND / 2
    for (let i = 0; i < cfg.count; i++) {
      let y = arr[i * 3 + 1] + cfg.vy * dt
      if (cfg.vy < 0 && y < bot) y = top
      else if (cfg.vy > 0 && y > top) y = bot
      arr[i * 3 + 1] = y
      arr[i * 3] += Math.sin(t * 1.1 + phases[i]) * cfg.sway * dt
    }
    geom.attributes.position.needsUpdate = true
  })

  return (
    <points geometry={geom}>
      <pointsMaterial
        color={cfg.color}
        size={cfg.size}
        transparent
        opacity={cfg.opacity}
        sizeAttenuation
        depthWrite={false}
        blending={cfg.additive ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  )
}

function CloudPuff({ x, y, z, scale, speed, tint }: { x: number; y: number; z: number; scale: number; speed: number; tint: string }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    g.position.x += speed * dt
    if (g.position.x > SPREAD + 3) g.position.x = -SPREAD - 3
    const camY = state.camera.position.y
    if (g.position.y < camY - BAND / 2) g.position.y += BAND
    else if (g.position.y > camY + BAND / 2) g.position.y -= BAND
  })
  const puffs: [number, number, number, number][] = [
    [0, 0, 0, 1], [0.9, -0.1, 0, 0.75], [-0.9, -0.05, 0, 0.7], [0.35, 0.35, 0.2, 0.65], [-0.4, 0.3, -0.1, 0.6],
  ]
  return (
    <group ref={ref} position={[x, y, z]} scale={scale}>
      {puffs.map(([px, py, pz, s], i) => (
        <mesh key={i} position={[px, py, pz]} scale={[1.3 * s, 0.9 * s, 1 * s]}>
          <sphereGeometry args={[0.7, 16, 12]} />
          <meshStandardMaterial color={tint} roughness={1} transparent opacity={0.72} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

export default function Weather() {
  const weather = useGame((s) => s.weather)
  const clouds = useMemo(
    () =>
      Array.from({ length: 6 }, () => ({
        x: (Math.random() * 2 - 1) * SPREAD,
        y: (Math.random() * 2 - 1) * (BAND / 2),
        z: -7 - Math.random() * 7,
        scale: 1.4 + Math.random() * 1.8,
        speed: 0.25 + Math.random() * 0.4,
      })),
    []
  )

  return (
    <group>
      {clouds.map((c, i) => (
        <CloudPuff key={i} {...c} tint={weather.tint} />
      ))}
      <Particles key={weather.particle} type={weather.particle} />
    </group>
  )
}
