import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { CanvasTexture, DoubleSide, MathUtils, NearestFilter, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three"
import { useGame, wpm, type CharacterLook } from "../game/store"
import { objectFor, slotWorldPos, panForWord } from "../game/config"
import { audio } from "../audio/AudioEngine"
import { charWorldPos, shake } from "./sceneBus"

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

// ---------- pixel-art cat (side profile, facing right) ----------

const GW = 32 // grid width
const GH = 22 // grid height
const PX = 8 // canvas pixels per grid cell

export type CatPose =
  | "idle0" | "idle1"
  | "walk0" | "walk1" | "walk2" | "walk3"
  | "run0" | "run1" | "run2" | "run3"
  | "air"

function shade(hex: string, f: number): string {
  const v = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.round(((v >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((v >> 8) & 255) * f))
  const b = Math.min(255, Math.round((v & 255) * f))
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

/** Draw one frame of the cat onto a canvas. */
export function drawCatFrame(look: CharacterLook, pose: CatPose): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = GW * PX
  c.height = GH * PX
  const ctx = c.getContext("2d")!
  ctx.imageSmoothingEnabled = false
  const px = (color: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x) * PX, Math.round(y) * PX, Math.round(w) * PX, Math.round(h) * PX)
  }
  const clr = (x: number, y: number, w = 1, h = 1) => {
    ctx.clearRect(Math.round(x) * PX, Math.round(y) * PX, Math.round(w) * PX, Math.round(h) * PX)
  }
  const fur = look.fur
  const dark = shade(fur, 0.72)
  const cream = "#fff3e6"
  const ink = "#22222e"
  const pink = "#ff9ec2"
  const scarf = look.accent

  const idle = pose.startsWith("idle")
  const run = pose.startsWith("run")
  const air = pose === "air"
  const frame = idle || air ? Number(pose === "idle1") : Number(pose.slice(-1))

  if (idle) {
    // --- sitting cat ---
    const flick = frame === 1
    // haunch + body (upright wedge, rounded rump)
    px(fur, 9, 9, 10, 9) // rump block
    clr(9, 9)
    clr(18, 9)
    px(fur, 11, 6, 8, 4) // chest rising
    px(dark, 9, 16, 10, 2) // shadow base
    px(cream, 15, 10, 4, 7) // chest patch
    // head (rounded corners)
    px(fur, 15, 1, 9, 7)
    clr(15, 1)
    clr(23, 1)
    clr(15, 7)
    clr(23, 7)
    px(fur, 15, 0, 2, 2) // ear back
    px(fur, 22, 0, 2, 2) // ear front
    px(pink, 16, 0, 1, 1)
    px(pink, 23, 0, 1, 1)
    px(ink, 21, 3, 1, 2) // eye
    px(pink, 23, 5, 1, 1) // tiny nose
    px(pink, 20, 6, 1, 1) // blush
    px(cream, 24, 4, 1, 1) // dainty whiskers
    px(cream, 24, 6, 1, 1)
    // scarf
    px(scarf, 15, 8, 8, 2)
    // front legs (straight down)
    px(fur, 16, 12, 2, 7)
    px(cream, 16, 18, 2, 1)
    // tail wrapped around front, tip flicks
    px(dark, 6, 17, 10, 2)
    px(dark, 5, 15 - (flick ? 2 : 0), 2, 3 + (flick ? 2 : 0))
    px(cream, 5, 13 - (flick ? 2 : 0), 2, 2)
    return c
  }

  // --- standing / moving cat ---
  const stretch = run || air
  const bob = run ? [0, -2, -1, 0][frame] : [0, -1, 0, -1][frame]
  const bodyY = 8 + bob
  const bodyX = stretch ? 5 : 7
  const bodyW = stretch ? 19 : 15
  // tail (streams back when running, S-curve when walking)
  if (stretch) {
    px(dark, bodyX - 4, bodyY - 1, 5, 2)
    px(cream, bodyX - 5, bodyY - 2, 2, 2)
  } else {
    px(dark, 3, bodyY - 3, 2, 4)
    px(dark, 4, bodyY, 3, 2)
    px(cream, 3, bodyY - 5, 2, 2)
  }
  // body (rounded corners)
  px(fur, bodyX, bodyY, bodyW, 7)
  clr(bodyX, bodyY)
  clr(bodyX + bodyW - 1, bodyY)
  px(cream, bodyX + 3, bodyY + 5, bodyW - 5, 2) // belly
  // head (rounded corners)
  const headX = stretch ? 22 : 20
  const headY = bodyY - 5 + (run ? 1 : 0)
  px(fur, headX, headY, 9, 8)
  clr(headX, headY)
  clr(headX + 8, headY)
  clr(headX, headY + 7)
  clr(headX + 8, headY + 7)
  px(fur, headX, headY - 1, 2, 2)
  px(fur, headX + 7, headY - 1, 2, 2)
  px(pink, headX + 1, headY - 1, 1, 1)
  px(pink, headX + 8, headY - 1, 1, 1)
  px(ink, headX + 6, headY + 3, 1, 2) // eye
  px(pink, headX + 8, headY + 5, 1, 1) // tiny nose
  px(pink, headX + 5, headY + 6, 1, 1) // blush
  px(cream, headX + 9, headY + 4, 1, 1) // dainty whiskers
  px(cream, headX + 9, headY + 6, 1, 1)
  // scarf at neck
  px(scarf, headX - 2, bodyY, 3, 3)

  // legs: two pairs, trot phases
  const groundY = 19
  const hipY = bodyY + 6
  const legLen = groundY - hipY
  const backX = bodyX + 2
  const frontX = bodyX + bodyW - 4
  let backNear = 0, backFar = 0, frontNear = 0, frontFar = 0
  let lift = 0
  if (run) {
    // gallop: gather -> full stretch (airborne) -> land -> push
    const phases: [number, number, number, number, number][] = [
      [1, 2, -1, -2, 1], // gather (tucked)
      [-3, -4, 3, 4, 2], // full stretch, airborne
      [-1, 0, 1, 2, 0], // front contact
      [2, 1, -2, -1, 0], // back push
    ]
    ;[backNear, backFar, frontNear, frontFar, lift] = phases[frame]
  } else if (air) {
    backNear = -3; backFar = -4; frontNear = 3; frontFar = 4; lift = 2
  } else {
    // walk: diagonal pairs swing
    const sw = [2, 0, -2, 0][frame]
    backNear = sw; backFar = -sw; frontNear = -sw; frontFar = sw
  }
  const drawLeg = (x: number, dx: number, color: string) => {
    const len = Math.max(2, legLen - lift)
    px(color, x + dx * 0.99, hipY, 2, len)
    px(cream, x + dx * 0.99, hipY + len - 1, 2, 1)
  }
  drawLeg(backX, backFar, dark)
  drawLeg(frontX, frontFar, dark)
  drawLeg(backX, backNear, fur)
  drawLeg(frontX, frontNear, fur)
  return c
}

export function catPreviewURL(look: CharacterLook): string {
  return drawCatFrame(look, "idle0").toDataURL()
}

const POSES: CatPose[] = ["idle0", "idle1", "walk0", "walk1", "walk2", "walk3", "run0", "run1", "run2", "run3", "air"]

function makeTextures(look: CharacterLook): Record<CatPose, CanvasTexture> {
  const out = {} as Record<CatPose, CanvasTexture>
  for (const p of POSES) {
    const tex = new CanvasTexture(drawCatFrame(look, p))
    tex.magFilter = NearestFilter
    tex.minFilter = NearestFilter
    out[p] = tex
  }
  return out
}

// ---------- character controller ----------

const SPRITE_W = 2.0
const SPRITE_H = 2.0 * (GH / GW)
const RUN_WPM = 45 // at/above this, the legs gallop

type Mode = "move" | "stagger" | "drop" | "recover"

/** The pixel cat: walks/runs across word platforms as you type, jumps on space, falls on red pileups. */
export default function Character() {
  const look = useGame((s) => s.character)
  const textures = useMemo(() => makeTextures(look), [look.fur, look.accent])

  const root = useRef<Group>(null)
  const plane = useRef<Mesh>(null)
  const from = useRef(new Vector3())
  const to = useRef(new Vector3())
  const goal = useRef(new Vector3())
  const dropEnd = useRef(new Vector3())
  const mode = useRef<Mode>("move")
  const t = useRef(1)
  const dur = useRef(0.2)
  const arc = useRef(0)
  const jumping = useRef(false)
  const spin = useRef(0)
  const anim = useRef(0)
  const facing = useRef(1)
  const goalW = useRef(-1)
  const lastSlip = useRef(useGame.getState().slipNonce)
  const inited = useRef(false)
  const camRight = useRef(new Vector3())

  useFrame(({ camera }, dt) => {
    const g = root.current
    const p = plane.current
    if (!g || !p) return
    const st = useGame.getState()
    const { baseWord, wi, ci, words } = st
    const W = baseWord + wi
    const len = words[wi]?.length ?? 1
    const angle = st.angles[wi] ?? 0
    const s = Math.min(ci, len - 0.4) // stand at the caret; hold at the platform edge when done
    const [gx, gy, gz] = slotWorldPos(angle, W, s, len)
    goal.current.set(gx, gy + objectFor(W + st.seed).halfHeight, gz)

    if (!inited.current) {
      g.position.copy(goal.current)
      to.current.copy(goal.current)
      goalW.current = W
      inited.current = true
    }

    // --- fall! (red pileup) stagger -> drop -> recover ---
    if (st.slipNonce !== lastSlip.current) {
      lastSlip.current = st.slipNonce
      mode.current = "stagger"
      t.current = 0
      dur.current = 0.22
      from.current.copy(g.position)
      to.current.copy(goal.current)
      dropEnd.current.set(
        from.current.x + (to.current.x - from.current.x) * 0.35,
        to.current.y,
        from.current.z + (to.current.z - from.current.z) * 0.35
      )
      goalW.current = W
    }

    // new target while moving normally: walk within a word, jump between words
    if (mode.current === "move" && goal.current.distanceToSquared(to.current) > 0.0004) {
      from.current.copy(g.position)
      to.current.copy(goal.current)
      t.current = 0
      jumping.current = W !== goalW.current
      goalW.current = W
      const horiz = Math.hypot(to.current.x - from.current.x, to.current.z - from.current.z)
      if (jumping.current) {
        dur.current = 0.38
        arc.current = Math.min(1, 0.45 + horiz * 0.05)
      } else {
        dur.current = MathUtils.clamp(horiz / 4.5, 0.1, 0.3) // walking speed
        arc.current = 0
      }
    }

    t.current = Math.min(1, t.current + dt / dur.current)
    const tt = t.current

    if (mode.current === "stagger") {
      g.position.copy(from.current)
      p.rotation.z = Math.sin(tt * 26) * 0.22 * (1 - tt * 0.5)
      if (tt >= 1) {
        mode.current = "drop"
        t.current = 0
        const dropH = Math.max(0.5, from.current.y - dropEnd.current.y)
        dur.current = 0.35 + Math.min(0.35, dropH * 0.08)
      }
    } else if (mode.current === "drop") {
      const eY = tt * tt
      g.position.x = MathUtils.lerp(from.current.x, dropEnd.current.x, smoother(tt))
      g.position.z = MathUtils.lerp(from.current.z, dropEnd.current.z, smoother(tt))
      g.position.y = MathUtils.lerp(from.current.y, dropEnd.current.y, eY)
      spin.current += dt * 9
      if (tt >= 1) {
        mode.current = "recover"
        t.current = 0
        dur.current = 0.28
        from.current.copy(g.position)
        to.current.copy(goal.current)
        audio.playThud(panForWord(angle))
        shake(0.55)
      }
    } else if (mode.current === "recover") {
      const e = smoother(tt)
      g.position.lerpVectors(from.current, to.current, e)
      g.position.y += Math.sin(Math.PI * tt) * 0.4
      spin.current = MathUtils.damp(spin.current % (Math.PI * 2), 0, 10, dt)
      if (tt >= 1) {
        mode.current = "move"
        to.current.copy(goal.current)
        p.rotation.z = 0
      }
    } else {
      const e = smoother(tt)
      g.position.lerpVectors(from.current, to.current, e)
      if (jumping.current) g.position.y += Math.sin(Math.PI * tt) * arc.current
      spin.current = MathUtils.damp(spin.current, 0, 10, dt)
      p.rotation.z = MathUtils.damp(p.rotation.z, 0, 8, dt)
    }

    // ---- sprite animation ----
    const falling = mode.current !== "move"
    const moving = !falling && tt < 1
    const speed = wpm(st)
    let pose: CatPose
    if (falling || (moving && jumping.current)) {
      pose = "air"
    } else if (moving) {
      const running = speed >= RUN_WPM
      anim.current += dt * (running ? 13 : 8)
      pose = `${running ? "run" : "walk"}${Math.floor(anim.current) % 4}` as CatPose
    } else {
      anim.current += dt * 1.6
      pose = `idle${Math.floor(anim.current) % 2}` as CatPose
    }
    const mat = p.material as MeshBasicMaterial
    if (mat.map !== textures[pose]) {
      mat.map = textures[pose]
      mat.needsUpdate = true
    }

    // ---- billboard + facing flip ----
    p.rotation.y = 0
    g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z)
    if (moving || falling) {
      camRight.current.set(1, 0, 0).applyQuaternion(camera.quaternion)
      const vx = to.current.x - from.current.x
      const vz = to.current.z - from.current.z
      const d = vx * camRight.current.x + vz * camRight.current.z
      if (Math.abs(d) > 0.05) facing.current = d >= 0 ? 1 : -1
    }
    p.scale.set(SPRITE_W * facing.current, SPRITE_H, 1)
    if (falling && mode.current === "drop") p.rotation.z = spin.current * facing.current

    charWorldPos.copy(g.position)
  })

  return (
    <group ref={root}>
      <mesh ref={plane} position={[0, SPRITE_H / 2, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={textures.idle0} transparent alphaTest={0.05} side={DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}
