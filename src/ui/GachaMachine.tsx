import { useEffect, useRef } from "react"

// Two-tone capsule colors (top shell, bottom shell) — matches the rarity fx hues.
const CAPS: [string, string][] = [
  ["#ff8ad0", "#ffd7ef"],
  ["#7db4ff", "#cfe4ff"],
  ["#ffcf5e", "#fff1c2"],
  ["#b6a3e8", "#e6dcff"],
  ["#5ff0d0", "#c6f7ec"],
  ["#ff9a6c", "#ffd6c4"],
]

// resting positions of the capsules inside the glass dome (grid cells)
const HOMES: [number, number][] = [
  [16, 22],
  [24, 24],
  [32, 22],
  [18, 15],
  [30, 14],
  [24, 16],
]

/**
 * A hand-drawn pixel-art capsule machine, redrawn every frame on a canvas so it
 * lives in the same art world as the climber sprites. Capsules bob under the
 * glass; cranking shakes the cabinet, spins the knob, and lights the prize hatch.
 * Respects prefers-reduced-motion (renders a single static frame).
 */
export default function GachaMachine({ cranking }: { cranking: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const crk = useRef(cranking)
  crk.current = cranking

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext("2d")
    if (!ctx) return
    const W = 48
    const H = 56
    const S = 4
    cv.width = W * S
    cv.height = H * S
    ctx.imageSmoothingEnabled = false

    let ox = 0
    let oy = 0
    const px = (c: string, x: number, y: number, w = 1, h = 1) => {
      ctx.fillStyle = c
      ctx.fillRect(Math.round(x + ox) * S, Math.round(y + oy) * S, Math.round(w) * S, Math.round(h) * S)
    }
    const clr = (x: number, y: number, w = 1, h = 1) => {
      ctx.clearRect(Math.round(x + ox) * S, Math.round(y + oy) * S, Math.round(w) * S, Math.round(h) * S)
    }
    const disc = (cx: number, cy: number, r: number, c: string) => {
      const r2 = r * r
      for (let y = Math.ceil(cy - r); y <= cy + r; y++)
        for (let x = Math.ceil(cx - r); x <= cx + r; x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) px(c, x, y)
    }
    const ring = (cx: number, cy: number, ro: number, ri: number, c: string) => {
      const ro2 = ro * ro
      const ri2 = ri * ri
      for (let y = Math.ceil(cy - ro); y <= cy + ro; y++)
        for (let x = Math.ceil(cx - ro); x <= cx + ro; x++) {
          const d2 = (x - cx) ** 2 + (y - cy) ** 2
          if (d2 <= ro2 && d2 >= ri2) px(c, x, y)
        }
    }
    const capsule = (cx: number, cy: number, top: string, lite: string) => {
      const r = 3
      const r2 = r * r
      for (let y = Math.ceil(cy - r); y <= cy + r; y++)
        for (let x = Math.ceil(cx - r); x <= cx + r; x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) px(y < cy ? top : lite, x, y)
      px("rgba(0,0,0,0.18)", cx - 2, cy, 5, 1) // seam
      px("#ffffff", cx - 1, cy - 2, 1, 1) // shine
    }

    const DX = 24
    const DY = 17
    const DR = 15 // dome center + radius
    let knobA = 0
    let raf = 0
    const start = performance.now()
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    const frame = (now: number) => {
      const t = reduce ? 0 : (now - start) / 1000
      const c = crk.current && !reduce
      ctx.clearRect(0, 0, cv.width, cv.height)
      ox = c ? Math.round(Math.sin(t * 34) * 1.5) : 0
      oy = c ? 0 : Math.round(Math.sin(t * 1.5) * 0.5) // idle breathe

      // ---- feet / base ----
      px("#2e313b", 15, 54, 20, 1)
      px("#4a4e5b", 14, 50, 20, 4)
      clr(14, 50); clr(33, 50)
      px("#6b7080", 15, 50, 18, 1) // top highlight
      px("#2e313b", 14, 53, 20, 1) // bottom shadow

      // ---- body (arcade cabinet) ----
      px("#d24d6e", 9, 34, 30, 18)
      clr(9, 34); clr(38, 34); clr(9, 51); clr(38, 51)
      px("#ff859d", 10, 34, 28, 2) // top light
      px("#ec6f8b", 9, 35, 2, 15) // left light
      px("#a83a56", 10, 49, 28, 2) // bottom shadow
      px("#b8405f", 37, 35, 2, 15) // right shadow
      // coin slot
      px("#ffd85a", 19, 37, 10, 1)
      px("#2a1420", 20, 38, 8, 2)
      // prize hatch
      px("#3a1a28", 16, 44, 12, 5)
      clr(16, 44); clr(27, 44)
      px(c ? "rgba(255,222,130,0.55)" : "rgba(255,222,130,0.14)", 17, 45, 10, 3) // glows on crank
      px("#2a1420", 18, 46, 8, 2)
      // crank knob (right side), notch spins while cranking
      disc(33, 41, 3, "#ffe08a")
      disc(33, 41, 2, "#f5b731")
      const nx = 33 + Math.cos(knobA) * 1.8
      const ny = 41 + Math.sin(knobA) * 1.8
      px("#7a4a00", Math.round(nx), Math.round(ny), 1, 1)

      // ---- neck ring (chrome) ----
      px("#b8c0d4", 16, 31, 16, 3)
      clr(16, 31); clr(31, 31); clr(16, 33); clr(31, 33)
      px("#edf1fa", 16, 31, 16, 1)
      px("#939bb0", 16, 33, 16, 1)

      // ---- dome interior (dark, so capsules pop) ----
      disc(DX, DY, DR, "rgba(28,32,50,0.62)")

      // ---- capsules ----
      HOMES.forEach(([hx, hy], i) => {
        const amp = c ? 1.9 : 0.7
        const spd = c ? 9 : 1.8
        const bob = Math.sin(t * spd + i * 1.7) * amp
        const wob = c ? Math.round(Math.sin(t * 13 + i) * 1) : 0
        capsule(hx + wob, hy + bob, CAPS[i][0], CAPS[i][1])
      })

      // ---- glass over the capsules ----
      ring(DX, DY, DR, DR - 1.6, "rgba(206,220,246,0.55)") // rim
      ring(DX, DY, DR - 1.6, DR - 2.4, "rgba(255,255,255,0.18)") // inner sheen
      // moving glint streak, upper-left
      const g = reduce ? 0 : (Math.sin(t * 0.7) + 1) / 2
      const gx = 13 + g * 2
      px("rgba(255,255,255,0.8)", gx, 8, 2, 1)
      px("rgba(255,255,255,0.7)", gx - 1, 10, 2, 1)
      px("rgba(255,255,255,0.5)", gx - 2, 12, 1, 1)

      // ---- topper bulb ----
      px("#ffd85a", 23, 1, 2, 2)
      px("#fff3c0", 23, 1, 1, 1)

      knobA += c ? 0.55 : 0
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} className="gacha-canvas" aria-hidden="true" />
}
