import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { CanvasTexture, DoubleSide, MathUtils, NearestFilter, Vector3, type Camera, type Group, type Mesh, type MeshBasicMaterial } from "three"
import { useGame, wpm, type CharacterLook } from "../game/store"
import { skinById, isModel, type AnimState, type CharacterDef, type ModelSpec } from "../game/skins"
import { objectFor, slotWorldPos, panForWord } from "../game/config"
import { audio } from "../audio/AudioEngine"
import { charWorldPos, shake } from "./sceneBus"
import { useCharacterModel } from "./useCharacterModel"

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

type PxFn = (color: string, x: number, y: number, w?: number, h?: number) => void
type ClrFn = (x: number, y: number, w?: number, h?: number) => void
interface Palette { fur: string; dark: string; belly: string; accent: string; pat: string; ink: string; pink: string }
interface Pose { idle: boolean; run: boolean; air: boolean; frame: number }

// Shared 4-legged trot/gallop used by cat/fox/panda.
function quadLegs(px: PxFn, P: Palette, bodyX: number, bodyW: number, bodyY: number, pi: Pose, near: string, far: string, foot: string, socks: boolean) {
  const groundY = 19, hipY = bodyY + 6, legLen = groundY - hipY
  const backX = bodyX + 2, frontX = bodyX + bodyW - 4
  let bn = 0, bf = 0, fn = 0, ff = 0, lift = 0
  if (pi.run) {
    const ph: [number, number, number, number, number][] = [[1, 2, -1, -2, 1], [-3, -4, 3, 4, 2], [-1, 0, 1, 2, 0], [2, 1, -2, -1, 0]]
    ;[bn, bf, fn, ff, lift] = ph[pi.frame]
  } else if (pi.air) { bn = -3; bf = -4; fn = 3; ff = 4; lift = 2 }
  else { const sw = [2, 0, -2, 0][pi.frame]; bn = sw; bf = -sw; fn = -sw; ff = sw }
  const leg = (x: number, dx: number, color: string) => {
    const len = Math.max(2, legLen - lift)
    px(color, x + dx * 0.99, hipY, 2, len)
    if (socks) px(P.pat, x + dx * 0.99, hipY + len - 2, 2, 2)
    else px(foot, x + dx * 0.99, hipY + len - 1, 2, 1)
  }
  leg(backX, bf, far); leg(frontX, ff, far); leg(backX, bn, near); leg(frontX, fn, near)
}

interface QuadOpts { ear: "cat" | "fox" | "round"; earColor: string; earTip?: string; tail: "thin" | "bushy" | "stub"; tailTip?: string; leg: string; legDark: string; foot: string; socks?: boolean; eyePatch?: boolean; muzzle?: boolean }

// A cat-shaped quadruped, parameterized so cat/fox/panda share the skeleton
// (trot, gallop, jump) but read as clearly different animals.
function drawQuad(px: PxFn, clr: ClrFn, P: Palette, pi: Pose, o: QuadOpts) {
  const ears = (hx: number, hy: number) => {
    if (o.ear === "round") {
      px(o.earColor, hx - 1, hy - 2, 3, 3); clr(hx - 1, hy - 2); clr(hx + 1, hy - 2)
      px(o.earColor, hx + 6, hy - 2, 3, 3); clr(hx + 6, hy - 2); clr(hx + 8, hy - 2)
      px(P.pink, hx, hy - 1, 1, 1); px(P.pink, hx + 7, hy - 1, 1, 1)
    } else if (o.ear === "fox") {
      px(o.earColor, hx, hy - 2, 2, 3); px(o.earColor, hx + 7, hy - 2, 2, 3)
      if (o.earTip) { px(o.earTip, hx, hy - 2, 2, 1); px(o.earTip, hx + 7, hy - 2, 2, 1) }
      px(P.pink, hx + 1, hy, 1, 1); px(P.pink, hx + 8, hy, 1, 1)
    } else {
      px(o.earColor, hx, hy - 1, 2, 2); px(o.earColor, hx + 7, hy - 1, 2, 2)
      px(P.pink, hx + 1, hy - 1, 1, 1); px(P.pink, hx + 8, hy - 1, 1, 1)
    }
  }

  if (pi.idle) {
    const flick = pi.frame === 1
    px(P.fur, 9, 9, 10, 9); clr(9, 9); clr(18, 9)
    px(P.fur, 11, 6, 8, 4)
    px(P.dark, 9, 16, 10, 2)
    px(P.belly, 15, 10, 4, 7)
    px(P.fur, 15, 1, 9, 7); clr(15, 1); clr(23, 1); clr(15, 7); clr(23, 7)
    ears(15, 1)
    if (o.eyePatch) { px(P.pat, 19, 2, 3, 4) }
    if (o.muzzle) px(P.belly, 21, 4, 3, 3)
    px(P.ink, 21, 3, 1, 2)
    px(P.pink, 23, 5, 1, 1)
    px(P.pink, 20, 6, 1, 1)
    px(P.belly, 24, 4, 1, 1); px(P.belly, 24, 6, 1, 1)
    px(P.accent, 15, 8, 8, 2)
    px(o.leg, 16, 12, 2, 7)
    px(o.socks ? P.pat : o.foot, 16, 17, 2, 2)
    // tail
    if (o.tail === "bushy") { px(P.fur, 3, 12, 5, 7); clr(3, 12); clr(7, 12); px(o.tailTip ?? P.belly, 3, 11, 4, 2) }
    else if (o.tail === "stub") { px(o.leg, 7, 15, 3, 3) }
    else { px(P.dark, 6, 17, 10, 2); px(P.dark, 5, 15 - (flick ? 2 : 0), 2, 3 + (flick ? 2 : 0)); px(P.belly, 5, 13 - (flick ? 2 : 0), 2, 2) }
    return
  }

  const stretch = pi.run || pi.air
  const bob = pi.run ? [0, -2, -1, 0][pi.frame] : [0, -1, 0, -1][pi.frame]
  const bodyY = 8 + bob
  const bodyX = stretch ? 5 : 7
  const bodyW = stretch ? 19 : 15
  // tail
  if (o.tail === "bushy") {
    if (stretch) { px(P.fur, bodyX - 6, bodyY - 2, 6, 5); px(o.tailTip ?? P.belly, bodyX - 7, bodyY - 2, 2, 3) }
    else { px(P.fur, 1, bodyY - 3, 4, 7); px(o.tailTip ?? P.belly, 1, bodyY - 4, 3, 2) }
  } else if (o.tail === "stub") { px(o.leg, bodyX - 1, bodyY + 3, 2, 2) }
  else {
    if (stretch) { px(P.dark, bodyX - 4, bodyY - 1, 5, 2); px(P.belly, bodyX - 5, bodyY - 2, 2, 2) }
    else { px(P.dark, 3, bodyY - 3, 2, 4); px(P.dark, 4, bodyY, 3, 2); px(P.belly, 3, bodyY - 5, 2, 2) }
  }
  px(P.fur, bodyX, bodyY, bodyW, 7); clr(bodyX, bodyY); clr(bodyX + bodyW - 1, bodyY)
  px(P.belly, bodyX + 3, bodyY + 5, bodyW - 5, 2)
  const headX = stretch ? 22 : 20
  const headY = bodyY - 5 + (pi.run ? 1 : 0)
  px(P.fur, headX, headY, 9, 8); clr(headX, headY); clr(headX + 8, headY); clr(headX, headY + 7); clr(headX + 8, headY + 7)
  ears(headX, headY)
  if (o.eyePatch) px(P.pat, headX + 4, headY + 2, 3, 4)
  if (o.muzzle) px(P.belly, headX + 4, headY + 4, 4, 3)
  px(P.ink, headX + 6, headY + 3, 1, 2)
  px(P.pink, headX + 8, headY + 5, 1, 1)
  px(P.pink, headX + 5, headY + 6, 1, 1)
  px(P.belly, headX + 9, headY + 4, 1, 1); px(P.belly, headX + 9, headY + 6, 1, 1)
  px(P.accent, headX - 2, bodyY, 3, 3)
  quadLegs(px, P, bodyX, bodyW, bodyY, pi, o.leg, o.legDark, o.foot, !!o.socks)
}

function drawCat(px: PxFn, clr: ClrFn, P: Palette, pi: Pose) {
  drawQuad(px, clr, P, pi, { ear: "cat", earColor: P.fur, tail: "thin", leg: P.fur, legDark: P.dark, foot: P.belly })
}
function drawFox(px: PxFn, clr: ClrFn, P: Palette, pi: Pose) {
  drawQuad(px, clr, P, pi, { ear: "fox", earColor: P.fur, earTip: P.pat, tail: "bushy", tailTip: P.belly, leg: P.fur, legDark: P.dark, foot: P.belly, socks: true, muzzle: true })
}
function drawPanda(px: PxFn, clr: ClrFn, P: Palette, pi: Pose) {
  drawQuad(px, clr, P, pi, { ear: "round", earColor: P.pat, tail: "stub", leg: P.pat, legDark: shade(P.pat, 0.85), foot: P.pat, eyePatch: true })
}

// A round bunny that HOPS (arcing body, ears sweeping back mid-leap).
function drawBunny(px: PxFn, _clr: ClrFn, P: Palette, pi: Pose) {
  const clr = _clr
  if (pi.idle) {
    px(P.fur, 10, 10, 10, 9); clr(10, 10); clr(19, 10); clr(10, 18); clr(19, 18)
    px(P.belly, 12, 13, 6, 4)
    px(P.belly, 8, 14, 3, 3) // cotton tail
    px(P.fur, 13, 4, 9, 8); clr(13, 4); clr(21, 4); clr(13, 11); clr(21, 11)
    px(P.fur, 15, -3, 2, 7); px(P.fur, 18, -3, 2, 7) // tall ears
    px(P.pink, 15, -1, 1, 4); px(P.pink, 18, -1, 1, 4)
    px(P.ink, 19, 7, 1, 2)
    px(P.pink, 21, 9, 1, 1)
    px(P.belly, 20, 8, 2, 1)
    px(P.accent, 13, 11, 9, 2)
    px(P.fur, 12, 17, 6, 2); px(P.belly, 12, 18, 6, 1) // big feet
    return
  }
  const arc = pi.run ? [-1, -5, -8, -3][pi.frame] : pi.air ? -6 : [0, -3, -5, -2][pi.frame]
  const by = 9 + arc
  px(P.fur, 7, by, 11, 8); clr(7, by); clr(17, by); clr(7, by + 7); clr(17, by + 7)
  px(P.belly, 9, by + 4, 7, 3)
  px(P.belly, 5, by + 2, 3, 3) // tail
  px(P.fur, 16, by - 2, 8, 7); clr(16, by - 2); clr(23, by - 2); clr(16, by + 4); clr(23, by + 4)
  const back = pi.air || pi.frame === 1 || pi.frame === 2
  if (back) { px(P.fur, 13, by - 4, 5, 2); px(P.fur, 11, by - 5, 4, 2); px(P.pink, 13, by - 4, 3, 1) }
  else { px(P.fur, 18, by - 7, 2, 6); px(P.fur, 21, by - 7, 2, 6); px(P.pink, 18, by - 5, 1, 3) }
  px(P.ink, 22, by + 1, 1, 2); px(P.pink, 24, by + 3, 1, 1)
  const ext = pi.air || pi.frame === 1 || pi.frame === 2
  if (ext) { px(P.fur, 5, by + 5, 6, 2); px(P.belly, 5, by + 6, 2, 1) }
  else { px(P.fur, 8, by + 6, 3, 3); px(P.belly, 8, by + 8, 3, 1) }
  px(P.fur, 17, by + 6, 2, 2); px(P.belly, 17, by + 7, 2, 1)
  px(P.accent, 16, by + 3, 3, 2)
}

// A squat frog with bulging eyes that LEAPS between steps.
function drawFrog(px: PxFn, _clr: ClrFn, P: Palette, pi: Pose) {
  const clr = _clr
  const lip = shade(P.fur, 0.55)
  if (pi.idle) {
    px(P.fur, 8, 12, 15, 6); clr(8, 12); clr(22, 12); clr(8, 17); clr(22, 17)
    px(P.belly, 11, 15, 9, 3)
    px(P.accent, 15, 14, 5, 1) // throat
    px(P.fur, 15, 8, 3, 3); clr(15, 8) // eye bulges
    px(P.fur, 19, 8, 3, 3); clr(21, 8)
    px(P.belly, 16, 9, 2, 2); px(P.ink, 17, 9, 1, 1)
    px(P.belly, 20, 9, 2, 2); px(P.ink, 21, 9, 1, 1)
    px(lip, 11, 14, 12, 1) // wide mouth
    px(P.pat, 10, 13, 2, 2); px(P.pat, 15, 13, 2, 2) // spots
    px(P.fur, 8, 16, 3, 3); px(P.fur, 20, 16, 3, 3) // haunches
    px(shade(P.fur, 0.8), 9, 18, 3, 1); px(shade(P.fur, 0.8), 20, 18, 3, 1)
    return
  }
  const arc = pi.run ? [-1, -6, -9, -3][pi.frame] : pi.air ? -7 : [0, -4, -6, -2][pi.frame]
  const by = 11 + arc
  px(P.fur, 7, by, 16, 6); clr(7, by); clr(22, by); clr(7, by + 5); clr(22, by + 5)
  px(P.belly, 10, by + 3, 9, 2)
  px(P.fur, 17, by - 2, 3, 3); clr(17, by - 2)
  px(P.belly, 18, by - 1, 2, 2); px(P.ink, 19, by - 1, 1, 1)
  px(lip, 11, by + 2, 12, 1)
  const ext = pi.air || pi.frame === 1 || pi.frame === 2
  if (ext) { px(P.fur, 3, by + 3, 7, 2); px(shade(P.fur, 0.8), 3, by + 4, 2, 1) }
  else { px(P.fur, 7, by + 5, 3, 2); px(shade(P.fur, 0.8), 7, by + 6, 3, 1) }
  px(P.fur, 19, by + 4, 2, 3); px(shade(P.fur, 0.8), 19, by + 6, 2, 1)
}

// An upright penguin that WADDLES (rocking body, shuffling feet).
function drawPenguin(px: PxFn, _clr: ClrFn, P: Palette, pi: Pose) {
  const clr = _clr
  if (pi.idle || pi.air) {
    px(P.fur, 11, 5, 10, 14); clr(11, 5); clr(20, 5); clr(11, 18); clr(20, 18)
    px(P.belly, 13, 8, 6, 10); clr(13, 8); clr(18, 8)
    px(P.fur, 12, 2, 9, 5); clr(12, 2); clr(20, 2)
    px(P.belly, 16, 4, 2, 2); px(P.ink, 17, 4, 1, 1); px(P.ink, 14, 4, 1, 1)
    px(P.accent, 19, 5, 3, 2); px(shade(P.accent, 0.8), 19, 6, 3, 1)
    const up = pi.air ? -2 : 0
    px(P.fur, 9, 8 + up, 2, 7); px(P.fur, 21, 8 + up, 2, 7) // flippers
    px(P.accent, 12, 19, 3, 2); px(P.accent, 16, 19, 3, 2)
    return
  }
  const tilt = [0, 1, 0, -1][pi.frame]
  const by = 5 + (pi.run ? [0, -1, 0, -1][pi.frame] : 0)
  const s = tilt
  px(P.fur, 11 + s, by, 10, 14); clr(11 + s, by); clr(20 + s, by); clr(11 + s, by + 13); clr(20 + s, by + 13)
  px(P.belly, 13 + s, by + 3, 6, 9); clr(13 + s, by + 3); clr(18 + s, by + 3)
  px(P.fur, 12 + s, by - 3, 9, 5); clr(12 + s, by - 3); clr(20 + s, by - 3)
  px(P.belly, 16 + s, by - 1, 2, 2); px(P.ink, 17 + s, by - 1, 1, 1); px(P.ink, 14 + s, by - 1, 1, 1)
  px(P.accent, 19 + s, by, 3, 2)
  px(P.fur, 9 + s, by + 3 + tilt, 2, 7); px(P.fur, 21 + s, by + 3 - tilt, 2, 7)
  const fstep = [0, 1, 0, -1][pi.frame]
  px(P.accent, 12 + fstep, 19, 3, 2); px(P.accent, 16 - fstep, 19, 3, 2)
}

const SPECIES: Record<string, (px: PxFn, clr: ClrFn, P: Palette, pi: Pose) => void> = {
  cat: drawCat, fox: drawFox, panda: drawPanda, bunny: drawBunny, frog: drawFrog, penguin: drawPenguin,
}

/** Draw one frame of the equipped character (any animal) onto a canvas. */
export function drawCatFrame(look: CharacterLook, pose: CatPose): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = GW * PX
  c.height = GH * PX
  const ctx = c.getContext("2d")!
  ctx.imageSmoothingEnabled = false
  const px: PxFn = (color, x, y, w = 1, h = 1) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x) * PX, Math.round(y) * PX, Math.round(w) * PX, Math.round(h) * PX)
  }
  const clr: ClrFn = (x, y, w = 1, h = 1) => {
    ctx.clearRect(Math.round(x) * PX, Math.round(y) * PX, Math.round(w) * PX, Math.round(h) * PX)
  }

  const skin = skinById(look.skin)
  // cat & fox let the player recolor their fur; the rest keep their species palette
  const recolorable = skin.species === "cat" || skin.species === "fox"
  const fur = recolorable && look.fur ? look.fur : skin.fur
  const accent = look.accent || skin.accent
  const P: Palette = { fur, dark: shade(fur, 0.72), belly: skin.belly, accent, pat: skin.patternColor, ink: "#22222e", pink: "#ff9ec2" }

  const idle = pose.startsWith("idle")
  const run = pose.startsWith("run")
  const air = pose === "air"
  const frame = idle || air ? Number(pose === "idle1") : Number(pose.slice(-1))

  ;(SPECIES[skin.species] ?? drawCat)(px, clr, P, { idle, run, air, frame })
  return c
}

export function catPreviewURL(look: CharacterLook): string {
  return drawCatFrame(look, "idle0").toDataURL()
}

/** Idle preview for a specific skin id (used by the shop grid). */
export function skinPreviewURL(skinId: string): string {
  return drawCatFrame({ skin: skinId, fur: "", accent: "" }, "idle0").toDataURL()
}

// ---------- diegetic pixel coin (same art pipeline as the animals) ----------
// The HUD/shop money is the same pixel-art as the 3D coin, not an emoji.
function drawCoinFrame(): HTMLCanvasElement {
  const N = 9
  const S = 3
  const c = document.createElement("canvas")
  c.width = N * S
  c.height = N * S
  const ctx = c.getContext("2d")!
  ctx.imageSmoothingEnabled = false
  const put = (color: string, x: number, y: number) => {
    ctx.fillStyle = color
    ctx.fillRect(x * S, y * S, S, S)
  }
  const RIM = "#c8961e", FACE = "#ffcf3a", HI = "#ffe08a", STAR = "#e79a15", SPARK = "#fff6d0"
  const cx = (N - 1) / 2
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - cx, y - cx)
      if (d > 4.3) continue
      put(d >= 3.3 ? RIM : FACE, x, y)
    }
  }
  // embossed star (matches the 3D coin's star)
  for (const [x, y] of [[4, 3], [3, 4], [4, 4], [5, 4], [4, 5]] as const) put(STAR, x, y)
  // top-left highlight + a spark
  for (const [x, y] of [[2, 2], [3, 2], [2, 3]] as const) put(HI, x, y)
  put(SPARK, 6, 2)
  return c
}

let _coinURL: string | null = null
/** Cached data-URL of the pixel coin — render at 18px with image-rendering:pixelated. */
export function coinURL(): string {
  if (!_coinURL) _coinURL = drawCoinFrame().toDataURL()
  return _coinURL
}

/**
 * The pixel climber, out of the 3D scene and into the chrome: crossfades the
 * idle0/idle1 frames (like the in-game idle) for a given look. Used as the auth
 * avatar peek and the shop diorama occupant.
 */
export function PixelSprite({ look, className, fps = 1.8 }: { look: CharacterLook; className?: string; fps?: number }) {
  const [frame, setFrame] = useState(0)
  const urls = useMemo(
    () => [drawCatFrame(look, "idle0").toDataURL(), drawCatFrame(look, "idle1").toDataURL()],
    [look.skin, look.fur, look.accent]
  )
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => 1 - f), 1000 / fps)
    return () => clearInterval(id)
  }, [fps])
  return <img className={className} src={urls[frame]} alt="" draggable={false} style={{ imageRendering: "pixelated" }} />
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

/** Per-frame output of the controller — the active renderer (sprite or model)
 *  turns this into a visual. Position is written straight to the root group. */
export interface PoseOut {
  spritePose: CatPose // exact sprite frame (sprite renderer only)
  animState: AnimState // logical clip state (model renderer only)
  facing: number // +1 / -1 travel direction relative to camera-right
  tumbleZ: number // roll of the body during stagger/fall
  moving: boolean
  falling: boolean
}

type StepFn = (dt: number, camera: Camera) => PoseOut

/**
 * The movement/physics brain. Owns all motion state, advances it each frame,
 * writes `root.position`, and returns a renderer-agnostic pose. This is the
 * single source of truth for gameplay — it never touches a mesh, so the visual
 * (2D sprite or 3D model) is fully decoupled and interchangeable.
 */
function useCharacterController(root: RefObject<Group | null>): StepFn {
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
  const roll = useRef(0) // body roll (was plane.rotation.z)
  const goalW = useRef(-1)
  const lastSlip = useRef(useGame.getState().slipNonce)
  const inited = useRef(false)
  const camRight = useRef(new Vector3())
  const sinkY = useRef(0) // how far the character has settled into slime (springy)
  const sinkV = useRef(0)
  const last = useRef<PoseOut>({ spritePose: "idle0", animState: "idle", facing: 1, tumbleZ: 0, moving: false, falling: false })

  return useCallback((dt, camera) => {
    const g = root.current
    if (!g) return last.current
    const st = useGame.getState()
    const { baseWord, wi, ci, words } = st
    const W = baseWord + wi
    const len = words[wi]?.length ?? 1
    const angle = st.angles[wi] ?? 0
    const s = Math.min(ci, len - 0.4) // stand at the caret; hold at the platform edge when done
    const [gx, gy, gz] = slotWorldPos(angle, W, s, len)
    const obj = objectFor(W + st.seed)
    const onSlime = obj.shape === "slime"
    // how far a soft surface gives under the character (matches the bar's own dent/bend)
    const softDepth = onSlime ? 0.2 : obj.shape === "butter" ? 0.07 : 0
    goal.current.set(gx, gy + obj.halfHeight, gz)

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
      roll.current = Math.sin(tt * 26) * 0.22 * (1 - tt * 0.5)
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
        roll.current = 0
      }
    } else {
      const e = smoother(tt)
      g.position.lerpVectors(from.current, to.current, e)
      if (jumping.current) g.position.y += Math.sin(Math.PI * tt) * arc.current
      spin.current = MathUtils.damp(spin.current, 0, 10, dt)
      roll.current = MathUtils.damp(roll.current, 0, 8, dt)
    }

    // ---- pose selection (sprite frame + logical anim state) ----
    const falling = mode.current !== "move"
    const moving = !falling && tt < 1
    const speed = wpm(st)
    let spritePose: CatPose
    let animState: AnimState
    if (falling || (moving && jumping.current)) {
      spritePose = "air"
      animState = mode.current === "recover" ? "land" : moving && jumping.current ? "jump" : "fall"
    } else if (moving) {
      const running = speed >= RUN_WPM
      anim.current += dt * (running ? 13 : 8)
      spritePose = `${running ? "run" : "walk"}${Math.floor(anim.current) % 4}` as CatPose
      animState = running ? "run" : "walk"
    } else {
      anim.current += dt * 1.6
      spritePose = `idle${Math.floor(anim.current) % 2}` as CatPose
      animState = "idle"
    }

    // ---- facing (relative to camera-right, so left/right reads on the spiral) ----
    if (moving || falling) {
      camRight.current.set(1, 0, 0).applyQuaternion(camera.quaternion)
      const vx = to.current.x - from.current.x
      const vz = to.current.z - from.current.z
      const d = vx * camRight.current.x + vz * camRight.current.z
      if (Math.abs(d) > 0.05) facing.current = d >= 0 ? 1 : -1
    }
    const tumbleZ = falling && mode.current === "drop" ? spin.current * facing.current : roll.current

    // rest into a soft surface: the character descends by however much the surface
    // gives beneath it (goo dents, butter bends) — the SAME spring the bar uses —
    // so the bar's give carries it down. Eases back out as it steps off.
    const airborne = jumping.current && tt < 1 // mid-hop between words
    const grounded = softDepth > 0 && mode.current === "move" && !airborne
    const sinkTarget = grounded ? softDepth : 0
    const ds = Math.min(dt, 1 / 30)
    sinkV.current += ((sinkTarget - sinkY.current) * 150 - sinkV.current * 15) * ds
    sinkY.current = Math.max(0, sinkY.current + sinkV.current * ds)
    if (sinkY.current > 0.0005) {
      const idle = onSlime ? Math.sin(performance.now() / 520) * 0.015 * (sinkY.current / 0.2) : 0
      g.position.y -= sinkY.current + idle
    }

    charWorldPos.copy(g.position)
    last.current = { spritePose, animState, facing: facing.current, tumbleZ, moving, falling }
    return last.current
  }, [root])
}

/** Billboarded pixel-sprite renderer — the original look. Reads the controller
 *  each frame and paints the matching frame onto a camera-facing plane. */
function SpriteRenderer({ look, step, root }: { look: CharacterLook; step: StepFn; root: RefObject<Group | null> }) {
  const textures = useMemo(() => makeTextures(look), [look.skin, look.fur, look.accent])
  const plane = useRef<Mesh>(null)

  useFrame(({ camera }, dt) => {
    const g = root.current
    const p = plane.current
    if (!g || !p) return
    const pose = step(dt, camera)
    // billboard toward camera + facing flip
    p.rotation.y = 0
    g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z)
    p.scale.set(SPRITE_W * pose.facing, SPRITE_H, 1)
    p.rotation.z = pose.tumbleZ
    const mat = p.material as MeshBasicMaterial
    if (mat.map !== textures[pose.spritePose]) {
      mat.map = textures[pose.spritePose]
      mat.needsUpdate = true
    }
  })

  return (
    <mesh ref={plane} position={[0, SPRITE_H / 2, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={textures.idle0} transparent alphaTest={0.05} side={DoubleSide} toneMapped={false} />
    </mesh>
  )
}

/** 3D GLB renderer. Drives the mixer from the controller's logical anim state
 *  and yaws the model to face travel direction. Suspends while the GLB loads;
 *  a load/clip failure is caught by ModelFallbackBoundary → SpriteRenderer. */
function ModelRenderer({ def, step, root }: { def: CharacterDef & { model: ModelSpec }; step: StepFn; root: RefObject<Group | null> }) {
  const { scene, play } = useCharacterModel(def.model)

  useFrame(({ camera }, dt) => {
    const g = root.current
    if (!g) return
    const pose = step(dt, camera)
    play(pose.animState)
    // face travel direction. `facing` is signed relative to camera-right, so a
    // camera-facing yaw plus a half-turn on flip keeps the model reading L/R on
    // the spiral. (Tuned against the first real asset in Phase 5.)
    const toCam = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z)
    g.rotation.y = toCam + (pose.facing >= 0 ? 0 : Math.PI)
    g.rotation.z = pose.tumbleZ
  })

  const m = def.model
  return <primitive object={scene} scale={m.scale} position={m.offset} rotation={m.rotation} />
}

/** If a character model throws (bad GLB, missing file, decode error), fall back
 *  to the pixel sprite so the game never shows an empty plane. */
class ModelFallbackBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    if (import.meta.env.DEV) console.warn("[character] model failed to load — using sprite fallback", err)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** The player character: one movement controller, one of two interchangeable
 *  renderers chosen by the equipped character's `kind`. Sprite and model
 *  characters coexist; a model that fails to load degrades to the sprite. */
export default function Character() {
  const look = useGame((s) => s.character)
  const def = skinById(look.skin)
  const root = useRef<Group>(null)
  const step = useCharacterController(root)
  const sprite = <SpriteRenderer look={look} step={step} root={root} />

  return (
    <group ref={root}>
      {isModel(def) ? (
        <ModelFallbackBoundary fallback={sprite}>
          <Suspense fallback={sprite}>
            <ModelRenderer key={def.id} def={def} step={step} root={root} />
          </Suspense>
        </ModelFallbackBoundary>
      ) : (
        sprite
      )}
    </group>
  )
}
