import { freqFor, type Impact, type MaterialSound } from "../game/config"

/**
 * Web Audio synthesis engine — the soul of Thock.
 * Two layers per keystroke: a mechanical switch "thock" + the material "squish",
 * pitched to a rising pentatonic scale, positioned in 3D (HRTF binaural),
 * with a flow-driven reverb tail and a subtle ambience bed.
 *
 * v1 is fully procedural (no samples) so it works instantly; the hybrid plan
 * swaps organic recorded samples into playMaterial() later.
 */
class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private dry!: GainNode
  private reverb!: ConvolverNode
  private wet!: GainNode
  private noiseBuf!: AudioBuffer
  private ambienceGain: GainNode | null = null
  private ambLp: BiquadFilterNode | null = null
  private padGain: GainNode | null = null
  private ambBase = 0.03 // base ambience level for the current weather

  /** Must be called from a user gesture (first keypress). Safe to call repeatedly. */
  start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume()
      return
    }
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    this.ctx = ctx

    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(ctx.destination)

    this.dry = ctx.createGain()
    this.dry.gain.value = 1
    this.dry.connect(this.master)

    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.makeImpulse(1.4, 2.6)
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.08 // rises with flow
    this.reverb.connect(this.wet)
    this.wet.connect(this.master)

    this.noiseBuf = this.makeNoise(0.4)
    this.startAmbience()
  }

  setMuted(m: boolean) {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05)
    }
  }

  /** Flow (0..1) opens up reverb + ambience for a warmer, deeper mix. */
  setFlow(flow: number) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.wet.gain.setTargetAtTime(0.06 + flow * 0.3, t, 0.2)
    if (this.ambienceGain) this.ambienceGain.gain.setTargetAtTime(this.ambBase + flow * 0.04, t, 0.4)
  }

  /** Match the ambience bed to the current weather. */
  setAmbience(weather: string) {
    if (!this.ctx || !this.ambLp || !this.ambienceGain || !this.padGain) return
    const t = this.ctx.currentTime
    // filter brightness + base level per weather; pad on for warm skies
    const map: Record<string, { lp: number; base: number; pad: number }> = {
      sunny: { lp: 700, base: 0.025, pad: 0.04 },
      rainy: { lp: 3200, base: 0.075, pad: 0 },
      snowy: { lp: 320, base: 0.03, pad: 0.015 },
      sunset: { lp: 520, base: 0.028, pad: 0.05 },
    }
    const m = map[weather] ?? map.sunny
    this.ambBase = m.base
    this.ambLp.frequency.setTargetAtTime(m.lp, t, 0.6)
    this.ambienceGain.gain.setTargetAtTime(m.base, t, 0.8)
    this.padGain.gain.setTargetAtTime(m.pad, t, 0.8)
  }

  /** A correct keystroke: impact layer + material sound, pitched + panned. */
  playKey(pitch: number, pan: number, sound: MaterialSound, impact: Impact, flow: number) {
    if (!this.ctx) return
    const freq = freqFor(pitch)
    this.playImpact(impact, freq, pan)
    this.playMaterial(sound, freq, pan)
    this.setFlow(flow)
  }

  /** A keycap keystroke with the selected switch tone. */
  playKeycap(tone: "mt3" | "xda", pitch: number, pan: number, flow: number) {
    const ctx = this.ctx
    if (!ctx) return
    const freq = freqFor(pitch)
    const t = ctx.currentTime
    const out = this.pan(pan, true)

    if (tone === "mt3") {
      // deep "thock": punchy low-mid resonant body + a quick bright tick, fast decay
      const body = ctx.createOscillator()
      body.type = "sine"
      body.frequency.setValueAtTime(freq * 0.55, t)
      body.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.08)
      const bp = ctx.createBiquadFilter()
      bp.type = "bandpass"
      bp.frequency.value = 190
      bp.Q.value = 3.5
      const bg = ctx.createGain()
      bg.gain.setValueAtTime(0.0001, t)
      bg.gain.exponentialRampToValueAtTime(0.34, t + 0.006)
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
      body.connect(bp).connect(bg).connect(out)
      body.start(t)
      body.stop(t + 0.15)

      const tick = ctx.createBufferSource()
      tick.buffer = this.noiseBuf
      const thp = ctx.createBiquadFilter()
      thp.type = "bandpass"
      thp.frequency.value = 1600
      const tg = ctx.createGain()
      tg.gain.setValueAtTime(0.14, t)
      tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
      tick.connect(thp).connect(tg).connect(out)
      tick.start(t)
      tick.stop(t + 0.04)
    } else {
      // "creamy": soft rounded body, rolled-off highs, smooth medium decay
      const body = ctx.createOscillator()
      body.type = "sine"
      body.frequency.setValueAtTime(freq * 0.8, t)
      body.frequency.exponentialRampToValueAtTime(freq * 0.62, t + 0.12)
      const lp = ctx.createBiquadFilter()
      lp.type = "lowpass"
      lp.frequency.value = 620
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.014)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17)
      body.connect(lp).connect(g).connect(out)
      body.start(t)
      body.stop(t + 0.19)

      // gentle muted transient
      const tick = ctx.createBufferSource()
      tick.buffer = this.noiseBuf
      const tlp = ctx.createBiquadFilter()
      tlp.type = "lowpass"
      tlp.frequency.value = 900
      const tg = ctx.createGain()
      tg.gain.setValueAtTime(0.1, t)
      tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
      tick.connect(tlp).connect(tg).connect(out)
      tick.start(t)
      tick.stop(t + 0.05)
    }
    this.setFlow(flow)
  }

  /** A mistype: dry, flat, deliberately un-satisfying. */
  playDud(pan = 0) {
    const ctx = this.ctx
    if (!ctx) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const hp = ctx.createBiquadFilter()
    hp.type = "highpass"
    hp.frequency.value = 1800
    const g = ctx.createGain()
    const t = ctx.currentTime
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    src.connect(hp).connect(g)
    g.connect(this.pan(pan, false)) // dry only, no reverb
    src.start(t)
    src.stop(t + 0.12)
  }

  // --- internals ---

  /** The footstep/switch layer under each landing — character varies per object. */
  private playImpact(impact: Impact, freq: number, pan: number) {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const out = this.pan(pan, true)

    if (impact === "snap") {
      // a tiny sharp tick — the material "snap" carries the rest
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      const hp = ctx.createBiquadFilter()
      hp.type = "highpass"
      hp.frequency.value = 3500
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.12, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02)
      src.connect(hp).connect(g).connect(out)
      src.start(t)
      src.stop(t + 0.04)
      return
    }

    if (impact === "soft") {
      // dull, low, muffled thud
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      const lp = ctx.createBiquadFilter()
      lp.type = "lowpass"
      lp.frequency.value = 500
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.12, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
      src.connect(lp).connect(g).connect(out)
      src.start(t)
      src.stop(t + 0.09)

      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = freq / 2.2
      const bg = ctx.createGain()
      bg.gain.setValueAtTime(0.0001, t)
      bg.gain.exponentialRampToValueAtTime(0.12, t + 0.008)
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
      osc.connect(bg).connect(out)
      osc.start(t)
      osc.stop(t + 0.13)
      return
    }

    // "click" — full mechanical thock (keycap)
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const bp = ctx.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = 2200
    bp.Q.value = 0.8
    const cg = ctx.createGain()
    cg.gain.setValueAtTime(0.25, t)
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
    src.connect(bp).connect(cg).connect(out)
    src.start(t)
    src.stop(t + 0.06)

    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(freq / 2, t)
    osc.frequency.exponentialRampToValueAtTime(freq / 2.6, t + 0.08)
    const bg = ctx.createGain()
    bg.gain.setValueAtTime(0.0001, t)
    bg.gain.exponentialRampToValueAtTime(0.22, t + 0.006)
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    osc.connect(bg).connect(out)
    osc.start(t)
    osc.stop(t + 0.14)
  }

  private playMaterial(sound: MaterialSound, freq: number, pan: number) {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const out = this.pan(pan, true)

    if (sound === "foam") {
      // soft filtered-noise crunch, mostly unpitched
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      const bp = ctx.createBiquadFilter()
      bp.type = "bandpass"
      bp.frequency.value = freq * 3
      bp.Q.value = 1.5
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
      src.connect(bp).connect(g).connect(out)
      src.start(t)
      src.stop(t + 0.14)
      return
    }

    if (sound === "marsh") {
      // marshmallow: soft airy pillow-puff
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq * 0.9, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.16)
      const lp = ctx.createBiquadFilter()
      lp.type = "lowpass"
      lp.frequency.value = 700
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26)
      osc.connect(lp).connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 0.28)
      return
    }

    if (sound === "ice") {
      // ice: crisp glassy tinkle — high ping + short bright noise
      const osc = ctx.createOscillator()
      osc.type = "triangle"
      osc.frequency.setValueAtTime(freq * 4, t)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.18, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      osc.connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 0.2)

      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      const hp = ctx.createBiquadFilter()
      hp.type = "highpass"
      hp.frequency.value = 6000
      const ng = ctx.createGain()
      ng.gain.setValueAtTime(0.1, t)
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
      src.connect(hp).connect(ng).connect(out)
      src.start(t)
      src.stop(t + 0.05)
      return
    }

    if (sound === "honey") {
      // honey: thick, slow, resonant gloop
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq * 0.5, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.9, t + 0.28)
      const lp = ctx.createBiquadFilter()
      lp.type = "lowpass"
      lp.frequency.value = 600
      lp.Q.value = 6
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34)
      osc.connect(lp).connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 0.36)
      return
    }

    if (sound === "slime") {
      // slime: stretchy wet gloop with a wobble
      const osc = ctx.createOscillator()
      osc.type = "sawtooth"
      osc.frequency.setValueAtTime(freq * 1.4, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.2)
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 18
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = freq * 0.12
      lfo.connect(lfoGain).connect(osc.frequency)
      const lp = ctx.createBiquadFilter()
      lp.type = "lowpass"
      lp.frequency.setValueAtTime(1800, t)
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.2)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
      osc.connect(lp).connect(g).connect(out)
      osc.start(t)
      lfo.start(t)
      osc.stop(t + 0.26)
      lfo.stop(t + 0.26)
      return
    }

    if (sound === "snap") {
      // chocolate crack: bright noise burst + fast descending "crack"
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      const hp = ctx.createBiquadFilter()
      hp.type = "highpass"
      hp.frequency.value = 2500
      const ng = ctx.createGain()
      ng.gain.setValueAtTime(0.24, t)
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
      src.connect(hp).connect(ng).connect(out)
      src.start(t)
      src.stop(t + 0.06)

      const osc = ctx.createOscillator()
      osc.type = "triangle"
      osc.frequency.setValueAtTime(freq * 3, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.9, t + 0.06)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
      osc.connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 0.1)
      return
    }

    if (sound === "butter") {
      // soft, low, muffled wet squish
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq * 0.75, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.22)
      const lp = ctx.createBiquadFilter()
      lp.type = "lowpass"
      lp.frequency.setValueAtTime(900, t)
      lp.frequency.exponentialRampToValueAtTime(360, t + 0.24)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
      osc.connect(lp).connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 0.32)
      return
    }

    if (sound === "pop") {
      // tiny bubble pop: quick downward pitch blip
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq * 2.4, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 1.1, t + 0.05)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
      osc.connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 0.1)
      return
    }

    // "squish" (jelly) and "gel": pitched wobble through a moving lowpass
    const osc = ctx.createOscillator()
    osc.type = sound === "gel" ? "sine" : "triangle"
    const up = sound === "gel"
    osc.frequency.setValueAtTime(freq * (up ? 0.8 : 1.25), t)
    osc.frequency.exponentialRampToValueAtTime(freq * (up ? 1.15 : 0.85), t + 0.14)
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.setValueAtTime(up ? 500 : 1600, t)
    lp.frequency.exponentialRampToValueAtTime(up ? 2400 : 700, t + 0.16)
    const g = ctx.createGain()
    const dur = sound === "gel" ? 0.24 : 0.2
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(lp).connect(g).connect(out)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  /** Returns an input node routed to a fresh HRTF panner -> dry + reverb. */
  private pan(x: number, sendReverb: boolean): AudioNode {
    const ctx = this.ctx!
    const p = ctx.createPanner()
    p.panningModel = "HRTF"
    p.distanceModel = "linear"
    p.positionX.value = x * 2
    p.positionY.value = 0
    p.positionZ.value = -1.2
    p.connect(this.dry)
    if (sendReverb) p.connect(this.reverb)
    return p
  }

  private startAmbience() {
    const ctx = this.ctx!
    // noise bed (rain hiss / wind) — filter + level set by setAmbience
    const src = ctx.createBufferSource()
    src.buffer = this.makeNoise(3)
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 700
    const g = ctx.createGain()
    g.gain.value = this.ambBase
    src.connect(lp).connect(g).connect(this.master)
    src.start()
    this.ambienceGain = g
    this.ambLp = lp

    // warm pad (two detuned sines) for sunny/sunset skies
    const pg = ctx.createGain()
    pg.gain.value = 0
    pg.connect(this.master)
    for (const detune of [-4, 3]) {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = 130.81 // C3
      osc.detune.value = detune
      const lp2 = ctx.createBiquadFilter()
      lp2.type = "lowpass"
      lp2.frequency.value = 500
      osc.connect(lp2).connect(pg)
      osc.start()
    }
    this.padGain = pg
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
      }
    }
    return buf
  }
}

export const audio = new AudioEngine()
