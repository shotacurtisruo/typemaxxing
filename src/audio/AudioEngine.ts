import { freqFor, panFor, type MaterialSound } from "../game/config"

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
    if (this.ambienceGain) this.ambienceGain.gain.setTargetAtTime(0.03 + flow * 0.05, t, 0.4)
  }

  /** A correct keystroke: switch thock + material squish, pitched + panned. */
  playKey(worldIndex: number, sound: MaterialSound, flow: number) {
    if (!this.ctx) return
    const freq = freqFor(worldIndex)
    const pan = panFor(worldIndex)
    this.playThock(freq, pan)
    this.playMaterial(sound, freq, pan)
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

  private playThock(freq: number, pan: number) {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const out = this.pan(pan, true)

    // click: short band-limited noise burst
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

    // body: low sine thump an octave down
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
    const src = ctx.createBufferSource()
    src.buffer = this.makeNoise(3)
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 700
    const g = ctx.createGain()
    g.gain.value = 0.03
    src.connect(lp).connect(g).connect(this.master)
    src.start()
    this.ambienceGain = g
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
