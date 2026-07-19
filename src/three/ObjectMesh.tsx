import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { RoundedBox, Text } from "@react-three/drei"
import type { Group, Mesh } from "three"
import type { ClimbObject } from "../game/config"
import { useGame } from "../game/store"
import { CAPS } from "./KeycapModel"

interface Crack {
  x: number
  y: number
  z: number
  rot: number
  tilt: number
  len: number
  op: number
  tier: number // 0 = always shown; higher tiers appear as the cat lands (crack level)
}

/** Cracks that grow as the cell is landed on. `level` rises 0→1→2 as the cat
 *  lands on / crosses the cell; higher-tier cracks scale in on each step. */
function CrackLines({ cracks, level, color = "#ffffff" }: { cracks: Crack[]; level: number; color?: string }) {
  const grp = useRef<Group>(null)
  const prev = useRef(level)
  const anim = useRef(1)
  useFrame((_, dt) => {
    const g = grp.current
    if (!g) return
    if (level !== prev.current) {
      if (level > prev.current) anim.current = 0 // a new tier just appeared — grow it in
      prev.current = level
    }
    if (anim.current < 1) anim.current = Math.min(1, anim.current + dt * 3.5)
    g.children.forEach((ch, i) => {
      const c = cracks[i]
      const vis = c.tier <= level
      ch.visible = vis
      if (vis) ch.scale.setX(c.tier === level ? Math.max(0.001, anim.current) : 1)
    })
  })
  return (
    <group ref={grp}>
      {cracks.map((c, k) => (
        <mesh key={k} position={[c.x, c.y, c.z]} rotation={[c.tilt * 0.4, c.rot, c.tilt]}>
          <boxGeometry args={[c.len, 0.016, 0.016]} />
          <meshBasicMaterial color={color} transparent opacity={c.op} />
        </mesh>
      ))}
    </group>
  )
}

/** One soft white marshmallow cylinder that SQUISHES when the cat lands on it
 *  (compresses down + bulges wide, then springs back). Short & wide. */
function Marshmallow({ seed, glow }: { seed: number; glow: number }) {
  const grp = useRef<Group>(null)
  const sq = useRef(0)
  const was = useRef(false)
  useFrame((_, dt) => {
    const landed = glow > 0
    if (landed && !was.current) sq.current = 1 // just landed → squish impulse
    was.current = landed
    if (sq.current > 0) sq.current = Math.max(0, sq.current - dt * 4.5) // spring back
    const g = grp.current
    if (g) {
      const k = sq.current
      g.scale.set(1 + k * 0.16, 1 - k * 0.26, 1 + k * 0.16)
    }
  })
  const r = 0.45 + hash(seed * 1.3 + 0.2) * 0.06 // wide
  const h = 0.34 + hash(seed * 3.3 + 0.7) * 0.12 // short
  const lean = (hash(seed * 4.7) * 2 - 1) * 0.05
  const tube = 0.09
  const cy = 0.5 - h / 2 - tube // rounded top rim peaks at +0.5
  const rimR = r - tube
  const col = "#fff6ef"
  const rimMat = (
    <meshStandardMaterial color={col} roughness={0.98} emissive={glow > 0 ? col : "#000000"} emissiveIntensity={glow * 0.3} />
  )
  return (
    <group ref={grp} rotation={[0, 0, lean]}>
      <mesh position={[0, cy, 0]}>
        <cylinderGeometry args={[r, r, h, 32]} />
        <meshStandardMaterial color={col} roughness={0.98} emissive={glow > 0 ? col : "#000000"} emissiveIntensity={glow * 0.3} />
      </mesh>
      <mesh position={[0, cy + h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rimR, tube, 14, 32]} />
        {rimMat}
      </mesh>
      <mesh position={[0, cy + h / 2 + tube, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[rimR, 32]} />
        <meshStandardMaterial color={col} roughness={0.98} emissive={glow > 0 ? col : "#000000"} emissiveIntensity={glow * 0.3} />
      </mesh>
      <mesh position={[0, cy - h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rimR, tube, 14, 32]} />
        <meshStandardMaterial color={col} roughness={0.98} emissive={glow > 0 ? col : "#000000"} emissiveIntensity={glow * 0.3} />
      </mesh>
    </group>
  )
}

/** Mostly-matte chocolate with just a hint of temper sheen. */
function ChocMat({ glow = 0, color = "#5f3417" }: { glow?: number; color?: string }) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={0.6}
      metalness={0}
      clearcoat={0.3}
      clearcoatRoughness={0.45}
      emissive={glow > 0 ? color : "#000000"}
      emissiveIntensity={glow * 0.4}
    />
  )
}

// per-key RGB sweep for the pudding keycaps (consecutive keys step one hue)
const RGB = ["#ff4d6d", "#ff9e3d", "#ffe14d", "#5ff0d0", "#4aa3ff", "#c07aff"]

/** Translucent "pudding" keycap: opaque sculpted top + glowing translucent skirt
 *  over an RGB underglow block. Uses emissive+opacity (not transmission, which
 *  renders invisible over the alpha canvas). */
function PuddingCap({ glow, rgb }: { glow: number; rgb: string }) {
  return (
    <group>
      {/* RGB underglow block on the plate (narrower than key pitch so gaps show) */}
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[0.9, 0.14, 0.9]} />
        <meshBasicMaterial color={rgb} toneMapped={false} />
      </mesh>
      {/* translucent glowing pudding skirt — base nearly touches neighbors */}
      <RoundedBox args={[0.9, 0.34, 0.9]} radius={0.07} smoothness={4} position={[0, -0.02, 0]}>
        <meshPhysicalMaterial
          color={rgb}
          emissive={rgb}
          emissiveIntensity={1.4 + glow}
          transparent
          opacity={0.5}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </RoundedBox>
      {/* opaque sculpted top — tapered narrower so keys are clearly separated (Keychron/OEM look) */}
      <RoundedBox args={[0.72, 0.32, 0.74]} radius={0.08} smoothness={4} position={[0, 0.17, 0]}>
        <meshPhysicalMaterial
          color="#24242a"
          roughness={0.32}
          clearcoat={0.7}
          clearcoatRoughness={0.2}
          emissive={glow > 0 ? rgb : "#000000"}
          emissiveIntensity={glow * 0.6}
        />
      </RoundedBox>
    </group>
  )
}

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

function Geometry({ object, glow, seed = 0, crack = 0 }: { object: ClimbObject; glow: number; seed?: number; crack?: number }) {
  const o = object
  switch (o.shape) {
    case "keycap": {
      // pudding + RGB (option C): consecutive keys sweep through the hue palette
      const rgb = RGB[(((Math.round(seed) % RGB.length) + RGB.length) % RGB.length)]
      return <PuddingCap glow={glow} rgb={rgb} />
    }

    case "chocolate": {
      // matte molded bar: dark base slab (connects cells into one bar) + two rows
      // of beveled segments whose width VARIES per cell (not machine-uniform).
      // Dark fracture cracks grow along the path the cat takes.
      // each row's segment width varies independently — handmade, not uniform
      const rows = [-0.32, 0.32]
      const segWs = [0.56 + hash(seed * 1.3 + 0.4) * 0.44, 0.56 + hash(seed * 1.9 + 0.7) * 0.44] // 0.56–1.0
      const segD = 0.44 + hash(seed * 2.6 + 0.1) * 0.14
      // fracture cracks sit ON a segment top and stay inside it (no bleed into grooves/air)
      const tiers = [0, 0, 1, 1, 2]
      const cracks: Crack[] = tiers.map((tier, k) => {
        const ri = hash(seed * 9.1 + k) > 0.5 ? 1 : 0
        const w = segWs[ri]
        const len = 0.12 + hash(seed * 5.5 + k) * 0.14 // 0.12–0.26
        const xm = Math.max(0, w / 2 - len / 2 - 0.06) // keep the whole crack on the segment
        return {
          tier,
          x: (hash(seed * 3.3 + k * 2.1) * 2 - 1) * xm,
          z: rows[ri],
          y: 0.225,
          rot: hash(seed * 2.1 + k * 3.7) * Math.PI,
          tilt: (hash(seed * 6.6 + k) * 2 - 1) * 0.12,
          len,
          op: 0.45 + hash(seed * 8.3 + k) * 0.3,
        }
      })
      return (
        <group>
          <RoundedBox args={[1.02, 0.14, 1.3]} radius={0.03} smoothness={3} position={[0, -0.08, 0]}>
            <ChocMat glow={glow} color="#2f1a0a" />
          </RoundedBox>
          {rows.map((z, i) => (
            <RoundedBox key={i} args={[segWs[i], 0.26, segD]} radius={0.06} smoothness={4} position={[0, 0.09, z]}>
              <ChocMat glow={glow} />
            </RoundedBox>
          ))}
          {/* fracture cracks (lighter matte interior) that grow as the cat crosses */}
          <CrackLines cracks={cracks} level={crack} color="#a06a3c" />
        </group>
      )
    }

    case "jelly": {
      // wobbly translucent gummy — each cell randomized (size, tint, lean,
      // highlight, bubble), tops aligned at +0.46 so the walk surface stays flat.
      const w = 0.78 + hash(seed * 1.3 + 0.2) * 0.26 // 0.78–1.04
      const d = 0.78 + hash(seed * 2.1 + 0.5) * 0.26
      const h = 0.66 + hash(seed * 3.3 + 0.7) * 0.26 // 0.66–0.92
      const lean = (hash(seed * 4.7) * 2 - 1) * 0.06
      const tints = ["#ff77b3", "#ff8ec2", "#f96ba6", "#ff6f9f", "#ef7ec0"]
      const col = tints[Math.floor(hash(seed * 5.9) * tints.length)]
      const cy = 0.46 - h / 2 // top face at +0.46
      const rad = Math.min(w, h, d) * 0.44
      const hx = (hash(seed * 6.7) * 2 - 1) * 0.22
      const hz = (hash(seed * 7.1) * 2 - 1) * 0.16
      return (
        <group rotation={[0, 0, lean]}>
          <RoundedBox args={[w, h, d]} radius={rad} smoothness={5} position={[0, cy, 0]}>
            <meshPhysicalMaterial
              color={col}
              transparent
              opacity={0.86}
              roughness={0.06}
              metalness={0}
              clearcoat={1}
              clearcoatRoughness={0.05}
              emissive={col}
              emissiveIntensity={0.12 + glow}
            />
          </RoundedBox>
          {/* wet glossy highlight catching the light */}
          <mesh position={[hx, 0.42, d * 0.3 + hz]} scale={[0.15, 0.07, 0.11]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.75} />
          </mesh>
          {/* a trapped air bubble */}
          <InnerBubble pos={[hx * 0.5, cy + 0.05, -hz]} r={0.03 + hash(seed * 8.3) * 0.03} />
        </group>
      )
    }

    case "butter": {
      // a wrapped butter stick — SEAMLESS (no segment/pat divisions): cells tile
      // into one continuous wrapped bar. Cream wrapper paper + a lengthwise fold
      // seam. Random cracks in the hard cold butter grow as the cat lands.
      const bh = 0.46
      const cy = 0.25 - bh / 2 // top at +0.25 (walkable)
      const wrap = "#efe3bf"
      const tiers = [0, 0, 1, 1, 2]
      const cracks: Crack[] = tiers.map((tier, k) => ({
        tier,
        x: (hash(seed * 3.3 + k * 2.1) * 2 - 1) * 0.3,
        z: (hash(seed * 4.1 + k * 1.7) * 2 - 1) * 0.3,
        y: 0.26,
        rot: hash(seed * 2.1 + k * 3.7) * Math.PI,
        tilt: (hash(seed * 6.6 + k) * 2 - 1) * 0.25,
        len: 0.16 + hash(seed * 5.5 + k) * 0.2,
        op: 0.4 + hash(seed * 8.3 + k) * 0.3,
      }))
      return (
        <group>
          {/* wrapped stick body (overlaps neighbours → one seamless bar) */}
          <RoundedBox args={[1.04, bh, 0.86]} radius={0.06} smoothness={3} position={[0, cy, 0]}>
            <meshStandardMaterial color={wrap} roughness={0.82} emissive={glow > 0 ? wrap : "#000000"} emissiveIntensity={glow * 0.3} />
          </RoundedBox>
          {/* lengthwise wrapper fold seam along the top */}
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[1.06, 0.014, 0.16]} />
            <meshStandardMaterial color="#dccf9f" roughness={0.8} />
          </mesh>
          {/* random cracks in the hard butter, growing along the cat's path */}
          <CrackLines cracks={cracks} level={crack} color="#bda76a" />
        </group>
      )
    }

    case "marshmallow":
      // short & wide soft white cylinder that squishes when landed on
      return <Marshmallow seed={seed} glow={glow} />

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

    case "ice": {
      // frosted glassy cube (alpha) + cloudy frozen core + RANDOM hairline cracks
      // that GROW as the cat lands (seeded per cell so they don't re-roll).
      const tiers = [0, 0, 1, 1, 2] // 2 always-on, 2 appear on landing, 1 on full cross
      const cracks: Crack[] = tiers.map((tier, k) => ({
        tier,
        x: (hash(seed * 3.3 + k * 2.1) * 2 - 1) * 0.3,
        z: (hash(seed * 4.1 + k * 1.7) * 2 - 1) * 0.3,
        y: (hash(seed * 7.2 + k) * 2 - 1) * 0.28,
        rot: hash(seed * 2.1 + k * 3.7) * Math.PI,
        tilt: (hash(seed * 6.6 + k) * 2 - 1) * 0.6,
        len: 0.34 + hash(seed * 5.5 + k) * 0.44,
        op: 0.4 + hash(seed * 8.3 + k) * 0.3,
      }))
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
          {/* cloudy frozen core */}
          <RoundedBox args={[0.42, 0.4, 0.42]} radius={0.12} smoothness={3}>
            <meshStandardMaterial color="#ffffff" transparent opacity={0.55} roughness={1} depthWrite={false} />
          </RoundedBox>
          {/* frost dusting on the top face */}
          <RoundedBox args={[0.84, 0.1, 0.84]} radius={0.05} smoothness={3} position={[0, 0.4, 0]}>
            <meshStandardMaterial color="#eaf6ff" transparent opacity={0.7} roughness={0.9} />
          </RoundedBox>
          {/* random hairline cracks that grow as the cat lands */}
          <CrackLines cracks={cracks} level={crack} color="#ffffff" />
        </group>
      )
    }

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

/**
 * ONE continuous wrapped butter stick spanning a whole word (no per-letter
 * segments). The bar is a single rounded body with a lengthwise wrapper fold,
 * twisted paper end-folds, and random cracks scattered along its length that
 * grow in behind the cat as it climbs. A warm glow patch tracks the caret cell.
 */
export function ButterStick({ n, gap, caret = -1, crossed = false }: { n: number; gap: number; caret?: number; crossed?: boolean }) {
  const bodyRef = useRef<Mesh>(null)
  const cracksRef = useRef<Group>(null)
  const pd = useRef(0) // press/bend amount (springy)
  const pv = useRef(0) // press velocity
  const pxr = useRef(0) // contact x, follows the caret with lag
  const prevCaret = useRef(caret)
  const crackProg = useRef<number[]>([])
  const bh = 0.46
  const cy = 0.25 - bh / 2 // top face at +0.25 (walkable)
  const L = n * gap // full bar length; cells overlap into one continuous stick
  const half = L / 2
  const catX = (i: number) => (i - (n - 1) / 2) * gap
  const wrap = "#efe3bf"
  const ink = "#b23a2e" // brick-red wrapper print
  const D = 0.86 // stick depth (front/back faces at ±D/2)
  const MAX_DIP = 0.13
  const WIDTH = 0.85

  // how far the stick sags at world-x `x` given the current bend
  const sag = (x: number) => {
    const d = (x - pxr.current) / WIDTH
    return MAX_DIP * pd.current * Math.exp(-d * d)
  }

  // decorations (text/ruler) re-registered each render so they can ride the bend
  const follow = useRef<{ el: { position: { y: number } }; x: number; y: number }[]>([])
  follow.current = []
  const reg = (x: number, y: number) => (el: { position: { y: number } } | null) => {
    if (el) follow.current.push({ el, x, y })
  }

  // "BUTTER" printed repeatedly along the wrapper, evenly spaced & centered.
  const labelStep = 1.7
  const labelCount = Math.max(1, Math.floor(L / labelStep))
  const labelXs = Array.from({ length: labelCount }, (_, i) => (i - (labelCount - 1) / 2) * labelStep)

  // cracks scattered along the whole bar; each forms (grows in) once the cat's
  // foot reaches its spot — so a fresh crack snaps in on the step you take there.
  const cracks = Array.from({ length: Math.max(6, n * 3) }, (_, k) => {
    const fx = hash(k * 3.3 + n * 1.7) // 0..1 along the bar
    return {
      x: (fx * 2 - 1) * (half - 0.16),
      z: (hash(k * 4.1 + 1.7) * 2 - 1) * 0.3,
      rot: hash(k * 2.1 + 3.7) * Math.PI,
      tilt: (hash(k * 6.6 + k) * 2 - 1) * 0.25,
      len: 0.16 + hash(k * 5.5 + 2.2) * 0.22,
      op: 0.45 + hash(k * 8.3 + 1.1) * 0.3,
    }
  })

  useFrame((_, dt) => {
    const dts = Math.min(dt, 1 / 30)
    const has = caret >= 0
    // slide the contact point toward the caret
    const targetX = has ? catX(caret) : pxr.current
    pxr.current += (targetX - pxr.current) * Math.min(1, dts * 10)
    // each new step gives the stick a fresh downward jolt (bend pulse)
    if (caret !== prevCaret.current) {
      if (has) pv.current += 9 // a sharp press on the new foot-fall
      prevCaret.current = caret
    }
    // spring the bend toward its resting value (stiff — butter barely gives)
    const target = has ? 0.5 : 0
    pv.current += ((target - pd.current) * 150 - pv.current * 18) * dts
    pd.current = Math.max(0, pd.current + pv.current * dts)

    // bend the ACTUAL body mesh: displace each vertex down by the local sag
    const body = bodyRef.current
    if (body) {
      const geo = body.geometry
      const pos = geo.attributes.position as unknown as { array: Float32Array; count: number; needsUpdate: boolean }
      const ud = body.userData as { base?: Float32Array }
      if (!ud.base) ud.base = pos.array.slice()
      const base = ud.base
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3]
        pos.array[i * 3 + 1] = base[i * 3 + 1] - sag(bx) // body sits at x=0 → local x = world x
      }
      pos.needsUpdate = true
      geo.computeVertexNormals()
    }

    // decorations ride the bent surface
    for (const f of follow.current) f.el.position.y = f.y - sag(f.x)

    // cracks: form (grow) once the cat reaches them, and ride the sag
    const cx = has ? pxr.current : crossed ? Infinity : -Infinity
    const g = cracksRef.current
    if (g) {
      g.children.forEach((ch, i) => {
        const c = cracks[i]
        const reached = crossed || c.x <= cx + gap * 0.35
        const cur = crackProg.current[i] ?? 0
        const next = reached ? Math.min(1, cur + dts * 6) : cur
        crackProg.current[i] = next
        ch.visible = next > 0.02
        ch.scale.setX(Math.max(0.001, next))
        ch.position.y = 0.26 - sag(c.x)
      })
    }
  })

  return (
    <group>
      {/* single continuous wrapped body — bends under the cat (vertex-displaced) */}
      <RoundedBox ref={bodyRef} args={[L, bh, D]} radius={0.05} smoothness={4} position={[0, cy, 0]}>
        <meshStandardMaterial color={wrap} roughness={0.82} />
      </RoundedBox>

      {/* wrapper print: "BUTTER" repeated on the top face (reads along the stick) */}
      {labelXs.map((x, i) => (
        <Text
          key={`top-${i}`}
          ref={reg(x, 0.2505)}
          position={[x, 0.2505, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.24}
          letterSpacing={0.08}
          color={ink}
          anchorX="center"
          anchorY="middle"
        >
          BUTTER
        </Text>
      ))}
      {/* wrapper print on the front face */}
      {labelXs.map((x, i) => (
        <Text
          key={`front-${i}`}
          ref={reg(x, cy + 0.02)}
          position={[x, cy + 0.02, D / 2 + 0.001]}
          fontSize={0.2}
          letterSpacing={0.08}
          color={ink}
          anchorX="center"
          anchorY="middle"
        >
          BUTTER
        </Text>
      ))}

      {/* "NET WT 4 OZ · 113 g" printed once on the front face, under the BUTTER print */}
      <Text
        ref={reg(0, cy - 0.13)}
        position={[0, cy - 0.13, D / 2 + 0.001]}
        fontSize={0.075}
        letterSpacing={0.04}
        color={ink}
        anchorX="center"
        anchorY="middle"
      >
        NET WT 4 OZ · 113 g
      </Text>

      {/* tablespoon ruler printed along the back top edge */}
      <group>
        {Array.from({ length: Math.max(2, Math.floor((L - 0.2) / 0.55)) + 1 }, (_, i) => {
          const step = (L - 0.2) / Math.max(1, Math.floor((L - 0.2) / 0.55))
          const x = -half + 0.1 + i * step
          return (
            <group key={`tick-${i}`}>
              {/* tick mark */}
              <mesh ref={reg(x, 0.2506)} position={[x, 0.2506, -D / 2 + 0.1]}>
                <boxGeometry args={[0.008, 0.006, 0.06]} />
                <meshStandardMaterial color={ink} roughness={0.8} />
              </mesh>
              {/* tick number */}
              <Text
                ref={reg(x, 0.2506)}
                position={[x, 0.2506, -D / 2 + 0.2]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.09}
                color={ink}
                anchorX="center"
                anchorY="middle"
              >
                {String(i + 1)}
              </Text>
            </group>
          )
        })}
        {/* ruler caption */}
        <Text
          ref={reg(0, 0.2506)}
          position={[0, 0.2506, -D / 2 + 0.33]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.07}
          letterSpacing={0.06}
          color={ink}
          anchorX="center"
          anchorY="middle"
        >
          TABLESPOONS
        </Text>
      </group>

      {/* folded-paper ends: flat tucked flap + envelope fold creases (no flared cap) */}
      {[-1, 1].map((s) => {
        const ex = s * (half + 0.002) // flush at the end face
        const dz = D / 2 - 0.06 // depth reach of the diagonal folds
        const dy = 0.2 // vertical rise of the folds toward the top-center peak
        const clen = Math.hypot(dy, dz)
        const cang = Math.atan2(dy, dz)
        return (
          <group key={s} position={[ex, 0, 0]}>
            {/* horizontal fold across the middle of the end */}
            <mesh position={[0, cy, 0]}>
              <boxGeometry args={[0.02, 0.02, D - 0.08]} />
              <meshStandardMaterial color="#cdbf90" roughness={0.85} />
            </mesh>
            {/* two diagonal creases rising to a tucked peak at the top-center */}
            <mesh position={[0, cy + dy / 2, dz / 2]} rotation={[cang, 0, 0]}>
              <boxGeometry args={[0.02, 0.02, clen]} />
              <meshStandardMaterial color="#cdbf90" roughness={0.85} />
            </mesh>
            <mesh position={[0, cy + dy / 2, -dz / 2]} rotation={[-cang, 0, 0]}>
              <boxGeometry args={[0.02, 0.02, clen]} />
              <meshStandardMaterial color="#cdbf90" roughness={0.85} />
            </mesh>
          </group>
        )
      })}
      {/* dry cracks that snap in underfoot as the cat crosses the hard butter */}
      <group ref={cracksRef}>
        {cracks.map((c, k) => (
          <mesh key={k} position={[c.x, 0.26, c.z]} rotation={[c.tilt * 0.4, c.rot, c.tilt]} visible={false}>
            <boxGeometry args={[c.len, 0.016, 0.016]} />
            <meshBasicMaterial color="#9c7f3f" transparent opacity={c.op} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/**
 * ONE continuous gooey slime path spanning a whole word (no per-letter blobs).
 * Built from overlapping lumps of varied size along a gently meandering line so
 * it reads as an uneven trail of goo — not a straight bar. Randomized side
 * bulges, drips and trapped bubbles (all seeded per word) make every slime
 * different. Where the cat stands, the goo itself sinks in with a sticky,
 * springy depression that follows the caret — the sink animation lives on the
 * bar, so a raised rim of goo squeezes up around the cat's feet.
 */
export function SlimeBlob({ object, n, gap, seed = 0, caret = -1 }: { object: ClimbObject; n: number; gap: number; seed?: number; caret?: number }) {
  const lumpMeshes = useRef<(Mesh | null)[]>([])
  const pd = useRef(0) // press amount 0→1 (springy)
  const pv = useRef(0) // press velocity (for the spring overshoot)
  const pxr = useRef(0) // press x, follows the caret with lag (sticky slide)
  const top = object.halfHeight // nominal walk height
  const L = n * gap
  const half = L / 2
  const D = 0.86
  const catX = (i: number) => (i - (n - 1) / 2) * gap
  const rnd = (k: number) => hash(seed * 7.13 + k * 1.37)

  // main body: overlapping lumps of varied radius along a meandering centerline.
  // Sphere tops all land near `top` (so it stays walkable) while radii/positions
  // vary → a lumpy, uneven goo trail rather than a clean tube.
  const lumpCount = Math.max(4, n * 2)
  const lumps = Array.from({ length: lumpCount }, (_, k) => {
    const t = lumpCount > 1 ? k / (lumpCount - 1) : 0.5
    const r = 0.32 + rnd(k) * 0.2 // 0.32–0.52 varied thickness
    const sy = 0.82 + rnd(k + 20) * 0.22
    return {
      x: -half + t * L + (rnd(k + 5) * 2 - 1) * 0.12,
      z: Math.sin(t * Math.PI * 2.2 + seed) * 0.1 + (rnd(k + 8) * 2 - 1) * 0.05, // weaves side to side
      y: top - r * sy + (rnd(k + 40) * 2 - 1) * 0.04, // sphere top ≈ walk height
      r,
      sy,
      phase: rnd(k + 30) * Math.PI * 2, // per-lump phase for the idle undulation
    }
  })

  // side bulges for a rounder, blobbier silhouette
  const lobes = Array.from({ length: Math.max(3, n + 1) }, (_, k) => {
    const side = k % 2 === 0 ? 1 : -1
    return {
      x: (rnd(k + 200) * 2 - 1) * (half - 0.15),
      z: side * (D / 2 - 0.06),
      y: top - 0.28 + (rnd(k + 240) * 2 - 1) * 0.08,
      r: 0.2 + rnd(k + 210) * 0.14,
      sy: 0.7 + rnd(k + 220) * 0.3,
    }
  })

  // teardrop drips hanging under random spots
  const drips = Array.from({ length: Math.max(2, Math.round(n / 2)) }, (_, k) => ({
    x: (rnd(k + 60) * 2 - 1) * (half - 0.2),
    z: (rnd(k + 70) * 2 - 1) * (D / 2 - 0.2),
    r: 0.09 + rnd(k + 80) * 0.08,
    len: 0.9 + rnd(k + 90) * 0.8,
  }))

  // trapped air bubbles scattered inside
  const bubbles = Array.from({ length: Math.max(2, n) }, (_, k) => ({
    x: (rnd(k + 100) * 2 - 1) * (half - 0.1),
    y: top - 0.25 + (rnd(k + 110) * 2 - 1) * 0.12,
    z: (rnd(k + 120) * 2 - 1) * (D / 2 - 0.15),
    r: 0.03 + rnd(k + 130) * 0.04,
  }))

  useFrame((_, dt) => {
    const dts = Math.min(dt, 1 / 30) // clamp so the spring stays stable on frame hitches
    const has = caret >= 0
    // sticky slide of the contact point toward the caret
    const targetX = has ? catX(caret) : pxr.current
    pxr.current += (targetX - pxr.current) * Math.min(1, dts * 9)
    // spring the press amount toward its target → soft landing with a little overshoot
    const targetD = has ? 1 : 0
    const stiffness = 150
    const damping = 15
    pv.current += ((targetD - pd.current) * stiffness - pv.current * damping) * dts
    pd.current += pv.current * dts
    const p = Math.max(0, pd.current)

    // deform the ACTUAL goo lumps: the one under the cat squashes (flattens down +
    // bulges out), neighbours bulge up as displaced goo — plus a gentle idle
    // undulation so the whole trail always feels soft and alive.
    const now = performance.now()
    const reach = 0.7
    for (let k = 0; k < lumps.length; k++) {
      const m = lumpMeshes.current[k]
      const b = lumps[k]
      if (!m) continue
      const idle = 1 + Math.sin(now / 520 + b.phase) * 0.025 // living jiggle
      const dx = Math.abs(b.x - pxr.current)
      const t = Math.max(0, 1 - dx / reach)
      const near = t * t * (3 - 2 * t) // smoothstep falloff around the contact
      const squash = near * p // 0..1 directly under the cat
      // outside the dent, goo is pushed slightly upward (rebound ring)
      const rebound = Math.max(0, 1 - Math.min(1, dx / (reach * 1.9))) * p * 0.14 * (1 - near)
      const sy = b.sy * idle * (1 - 0.55 * squash + rebound)
      const sxz = idle * (1 + 0.5 * squash)
      m.scale.set(sxz, sy, sxz)
      m.position.y = b.y // center fixed → shrinking sy lowers the top = a real dent
    }
  })

  return (
    <group>
      {/* lumpy goo trail — the main walkable body (deforms under the cat) */}
      {lumps.map((b, k) => (
        <mesh
          key={`lump-${k}`}
          ref={(el) => { lumpMeshes.current[k] = el }}
          position={[b.x, b.y, b.z]}
          scale={[1, b.sy, 1]}
        >
          <icosahedronGeometry args={[b.r, 3]} />
          <Mat o={object} glow={0} />
        </mesh>
      ))}
      {/* side bulges */}
      {lobes.map((b, k) => (
        <mesh key={`lobe-${k}`} position={[b.x, b.y, b.z]} scale={[1, b.sy, 1]}>
          <icosahedronGeometry args={[b.r, 2]} />
          <Mat o={object} glow={0} />
        </mesh>
      ))}
      {/* drips hanging underneath */}
      {drips.map((d, k) => (
        <mesh key={`drip-${k}`} position={[d.x, top - 0.5 - d.len * 0.12, d.z]} scale={[1, d.len, 1]}>
          <icosahedronGeometry args={[d.r, 2]} />
          <Mat o={object} glow={0} />
        </mesh>
      ))}
      {/* trapped bubbles */}
      {bubbles.map((b, k) => (
        <InnerBubble key={`bub-${k}`} pos={[b.x, b.y, b.z]} r={b.r} />
      ))}
    </group>
  )
}

interface Props {
  object: ClimbObject
  char?: string
  glow?: number
  showLetter?: boolean
  seed?: number // stable per-cell variety (e.g. letter index) — keeps random layouts from re-rolling
  crack?: number // ice crack level (0 untouched → 2 fully crossed)
}

export default function ObjectMesh({ object, char, glow = 0, showLetter = true, seed = 0, crack = 0 }: Props) {
  const keycap = useGame((s) => s.keycap)
  const isSpace = char === " "
  const ink =
    object.shape === "keycap" ? CAPS.find((c) => c.key === keycap)?.ink ?? object.ink : object.ink
  return (
    <group scale={isSpace ? [1.6, 1, 1] : [1, 1, 1]}>
      <Geometry object={object} glow={glow} seed={seed} crack={crack} />
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
