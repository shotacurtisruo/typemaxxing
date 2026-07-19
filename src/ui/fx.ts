// Tiny vanilla effect helpers — pixel-particle bursts, coins flying between
// elements, and a rAF number tween. Everything renders into a fixed #fx-layer
// (created lazily) so juice escapes any card/chip overflow clipping. All of it
// no-ops under prefers-reduced-motion.

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

function layer(): HTMLElement {
  let el = document.getElementById("fx-layer")
  if (!el) {
    el = document.createElement("div")
    el.id = "fx-layer"
    document.body.appendChild(el)
  }
  return el
}

interface BurstOpts {
  n?: number
  colors?: string[]
  spread?: number
  size?: number
}

/** A small pop of pixel squares outward from a screen point. */
export function burst(x: number, y: number, opts: BurstOpts = {}) {
  if (reduced()) return
  const { n = 5, colors = ["#ffcf3a", "#ffe08a"], spread = 60, size = 8 } = opts
  const root = layer()
  for (let i = 0; i < n; i++) {
    const p = document.createElement("div")
    p.className = "fx-particle"
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.9
    const dist = spread * (0.55 + Math.random() * 0.6)
    p.style.left = `${x}px`
    p.style.top = `${y}px`
    p.style.width = `${size}px`
    p.style.height = `${size}px`
    p.style.background = colors[i % colors.length]
    p.style.setProperty("--dx", `${Math.cos(a) * dist}px`)
    p.style.setProperty("--dy", `${Math.sin(a) * dist - 18}px`)
    p.style.setProperty("--rot", `${(Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 180)}deg`)
    p.addEventListener("animationend", () => p.remove())
    root.appendChild(p)
  }
}

/** Burst centered on an element. */
export function burstFrom(el: Element | null, opts: BurstOpts = {}) {
  if (!el) return
  const r = el.getBoundingClientRect()
  burst(r.left + r.width / 2, r.top + r.height / 2, opts)
}

/** Coins arcing from one element to another (the "money spent" beat). */
export function flyCoins(from: Element | null, to: Element | null, src: string, n = 4) {
  if (reduced() || !from || !to) return
  const a = from.getBoundingClientRect()
  const b = to.getBoundingClientRect()
  const x0 = a.left + a.width / 2
  const y0 = a.top + a.height / 2
  const dx = b.left + b.width / 2 - x0
  const dy = b.top + b.height / 2 - y0
  const root = layer()
  for (let i = 0; i < n; i++) {
    const img = document.createElement("img")
    img.src = src
    img.className = "fx-coin"
    img.style.left = `${x0}px`
    img.style.top = `${y0}px`
    img.style.setProperty("--dx", `${dx + (Math.random() * 24 - 12)}px`)
    img.style.setProperty("--dy", `${dy + (Math.random() * 24 - 12)}px`)
    img.style.animationDelay = `${i * 45}ms`
    img.addEventListener("animationend", () => img.remove())
    root.appendChild(img)
  }
}

/** rAF ease-out tween of an integer; calls cb each frame. Returns a cancel fn. */
export function countTween(from: number, to: number, ms: number, cb: (v: number) => void): () => void {
  if (reduced() || from === to || ms <= 0) {
    cb(to)
    return () => {}
  }
  const start = performance.now()
  let raf = requestAnimationFrame(function tick(now) {
    const k = Math.min(1, (now - start) / ms)
    const eased = 1 - Math.pow(1 - k, 3)
    cb(Math.round(from + (to - from) * eased))
    if (k < 1) raf = requestAnimationFrame(tick)
  })
  return () => cancelAnimationFrame(raf)
}
