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

    // up-stroke release tick ~100 ms after bottom-out — real switches sound twice
    if (tone === "mt3") {
      this.noiseBurst(out, t + 0.095, { type: "bandpass", freq: 2100, gain: 0.055, decay: 0.02 })
    } else {
      this.noiseBurst(out, t + 0.115, { type: "lowpass", freq: 1100, gain: 0.04, decay: 0.022 })
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

  /** Landing after a fall: a weighty body thud. */
  playThud(pan = 0) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const out = this.pan(pan, true)
    this.noiseBurst(out, t, { type: "lowpass", freq: 320, gain: 0.24, decay: 0.11 })
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(110, t)
    osc.frequency.exponentialRampToValueAtTime(58, t + 0.13)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17)
    osc.connect(g).connect(out)
    osc.start(t)
    osc.stop(t + 0.19)
  }

  /** A slip & fall: a descending comedic "whoop". */
  playSlip(pan = 0) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const out = this.pan(pan, true)
    const osc = ctx.createOscillator()
    osc.type = "sawtooth"
    osc.frequency.setValueAtTime(380, t)
    osc.frequency.exponentialRampToValueAtTime(85, t + 0.45)
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.setValueAtTime(1400, t)
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.45)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(lp).connect(g).connect(out)
    osc.start(t)
    osc.stop(t + 0.52)
  }

  // --- internals ---

  /** Schedule a filtered noise burst — the workhorse for wet/soft/brittle textures. */
  private noiseBurst(
    out: AudioNode,
    at: number,
    opts: { type: BiquadFilterType; freq: number; Q?: number; gain: number; attack?: number; decay: number }
  ) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = opts.type
    f.frequency.value = opts.freq
    if (opts.Q !== undefined) f.Q.value = opts.Q
    const g = ctx.createGain()
    const a = opts.attack ?? 0.002
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(opts.gain, at + a)
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + opts.decay)
    src.connect(f).connect(g).connect(out)
    src.start(at)
    src.stop(at + a + opts.decay + 0.03)
  }

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

  /**
   * Material sounds, grounded in each material's physics:
   * soft/wet things are NOISE sounds, hard things are TONE sounds.
   */
  private playMaterial(sound: MaterialSound, freq: number, pan: number) {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const out = this.pan(pan, true)

    if (sound === "foam") {
      // soft filtered-noise crunch, mostly unpitched
      this.noiseBurst(out, t, { type: "bandpass", freq: freq * 3, Q: 1.5, gain: 0.16, attack: 0.008, decay: 0.11 })
      return
    }

    if (sound === "marsh") {
      // marshmallow physics: foam compression pushes air through pores — an unpitched soft "fumf"
      this.noiseBurst(out, t, { type: "lowpass", freq: 550, gain: 0.16, attack: 0.03, decay: 0.18 })
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = Math.max(70, freq * 0.4)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      osc.connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 0.2)
      return
    }

    if (sound === "ice") {
      // ice physics: stiff crystal rings at INHARMONIC partials (glass clink) + crack onset
      this.noiseBurst(out, t, { type: "highpass", freq: 5000, gain: 0.15, decay: 0.012 })
      const base = freq * 2
      const partials: [number, number, number][] = [
        [1, 0.15, 0.16], // [ratio, gain, decay]
        [2.7, 0.08, 0.11],
        [4.3, 0.05, 0.08],
      ]
      for (const [ratio, gain, decay] of partials) {
        const osc = ctx.createOscillator()
        osc.type = "sine"
        osc.frequency.value = base * ratio
        const g = ctx.createGain()
        g.gain.setValueAtTime(gain, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
        osc.connect(g).connect(out)
        osc.start(t)
        osc.stop(t + decay + 0.02)
      }
      return
    }

    if (sound === "honey") {
      // honey physics: pressing a finger INTO a thick viscous pool — a slow sticky SQUELCH,
      // then the surface tension stringing apart as it lifts. Not bubbles: a wet compression.
      // (1) the squish: band-limited wet noise that swells as it's pressed and slowly releases
      const squish = ctx.createBufferSource()
      squish.buffer = this.noiseBuf
      squish.loop = true
      const slp = ctx.createBiquadFilter()
      slp.type = "lowpass"
      slp.Q.value = 7
      slp.frequency.setValueAtTime(260, t)
      slp.frequency.exponentialRampToValueAtTime(900, t + 0.11) // opens as it compresses
      slp.frequency.exponentialRampToValueAtTime(230, t + 0.44) // closes as it settles
      const sg = ctx.createGain()
      sg.gain.setValueAtTime(0.0001, t)
      sg.gain.exponentialRampToValueAtTime(0.2, t + 0.06)
      sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.46)
      squish.connect(slp).connect(sg).connect(out)
      squish.start(t)
      squish.stop(t + 0.48)
      // (2) viscous body: a heavy low sine sagging downward — thick fluid being displaced
      const body = ctx.createOscillator()
      body.type = "sine"
      body.frequency.setValueAtTime(Math.max(120, freq * 0.6), t)
      body.frequency.exponentialRampToValueAtTime(Math.max(68, freq * 0.32), t + 0.32)
      const bg = ctx.createGain()
      bg.gain.setValueAtTime(0.0001, t)
      bg.gain.exponentialRampToValueAtTime(0.17, t + 0.05)
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.36)
      body.connect(bg).connect(out)
      body.start(t)
      body.stop(t + 0.38)
      // (3) sticky release: honey strings pulling apart — faint high crackle ticks near the end
      for (const dt of [0.22, 0.29, 0.36]) {
        this.noiseBurst(out, t + dt, { type: "bandpass", freq: 2500, Q: 3, gain: 0.028, decay: 0.012 })
      }
      return
    }

    if (sound === "slime") {
      // crunchy-slime ASMR signature: dense micro-bubble crackle over a stretchy wobble
      const offs = [0.004, 0.018, 0.034, 0.052, 0.075, 0.1, 0.13, 0.165, 0.205]
      offs.forEach((dt, i) => {
        this.noiseBurst(out, t + dt, {
          type: "bandpass",
          freq: 1100 + (i % 4) * 380,
          Q: 2.5,
          gain: 0.1 * (1 - i / 11),
          decay: 0.008,
        })
      })
      const osc = ctx.createOscillator()
      osc.type = "sawtooth"
      osc.frequency.setValueAtTime(freq * 1.3, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.2)
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 16
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = freq * 0.1
      lfo.connect(lfoGain).connect(osc.frequency)
      const lp = ctx.createBiquadFilter()
      lp.type = "lowpass"
      lp.frequency.setValueAtTime(1200, t)
      lp.frequency.exponentialRampToValueAtTime(450, t + 0.2)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
      osc.connect(lp).connect(g).connect(out)
      osc.start(t)
      lfo.start(t)
      osc.stop(t + 0.26)
      lfo.stop(t + 0.26)
      return
    }

    if (sound === "snap") {
      // chocolate physics: brittle fracture PROPAGATES — a dry double micro-crack + tiny mass knock
      const dry = this.pan(pan, false) // bone dry, no reverb
      this.noiseBurst(dry, t, { type: "highpass", freq: 1800, gain: 0.27, decay: 0.018 })
      this.noiseBurst(dry, t + 0.015, { type: "highpass", freq: 2400, gain: 0.17, decay: 0.014 })
      const knock = ctx.createOscillator()
      knock.type = "sine"
      knock.frequency.value = Math.max(180, freq * 0.7)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.13, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
      knock.connect(g).connect(dry)
      knock.start(t)
      knock.stop(t + 0.06)
      return
    }

    if (sound === "butter") {
      // butter physics: spreading friction — creamy low-passed noise smear, then faint sticky ticks
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      src.loop = true
      const lp = ctx.createBiquadFilter()
      lp.type = "lowpass"
      lp.frequency.setValueAtTime(500, t)
      lp.frequency.exponentialRampToValueAtTime(180, t + 0.26)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
      src.connect(lp).connect(g).connect(out)
      src.start(t)
      src.stop(t + 0.33)
      // low body under the smear
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = Math.max(80, freq * 0.5)
      const bg = ctx.createGain()
      bg.gain.setValueAtTime(0.0001, t)
      bg.gain.exponentialRampToValueAtTime(0.06, t + 0.03)
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      osc.connect(bg).connect(out)
      osc.start(t)
      osc.stop(t + 0.22)
      // sticky release ticks
      this.noiseBurst(out, t + 0.17, { type: "highpass", freq: 2600, gain: 0.032, decay: 0.01 })
      this.noiseBurst(out, t + 0.23, { type: "highpass", freq: 3200, gain: 0.026, decay: 0.008 })
      return
    }

    if (sound === "pop") {
      // bubble physics: film rupture — a tiny broadband "pik", almost no low end
      this.noiseBurst(out, t, { type: "highpass", freq: 2500, gain: 0.2, decay: 0.01 })
      const ping = ctx.createOscillator()
      ping.type = "sine"
      ping.frequency.value = freq * 2.5
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.11, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
      ping.connect(g).connect(out)
      ping.start(t)
      ping.stop(t + 0.07)
      // whisper of a sweep for game readability
      const sw = ctx.createOscillator()
      sw.type = "sine"
      sw.frequency.setValueAtTime(freq * 2.2, t)
      sw.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.03)
      const sg = ctx.createGain()
      sg.gain.setValueAtTime(0.04, t)
      sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.035)
      sw.connect(sg).connect(out)
      sw.start(t)
      sw.stop(t + 0.05)
      return
    }

    if (sound === "squish") {
      // jelly physics: wet surface smack + low "blub" + you can HEAR the wobble (12 Hz tremolo tail)
      this.noiseBurst(out, t, { type: "bandpass", freq: 900, Q: 1, gain: 0.2, decay: 0.028 })
      const blub = ctx.createOscillator()
      blub.type = "sine"
      blub.frequency.setValueAtTime(freq * 0.9, t)
      blub.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.12)
      const bg = ctx.createGain()
      bg.gain.setValueAtTime(0.0001, t)
      bg.gain.exponentialRampToValueAtTime(0.22, t + 0.008)
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
      blub.connect(bg).connect(out)
      blub.start(t)
      blub.stop(t + 0.16)
      // wobble tail: carrier amplitude-modulated at ~12 Hz — the audible jiggle
      const carrier = ctx.createOscillator()
      carrier.type = "sine"
      carrier.frequency.value = freq * 0.75
      const cg = ctx.createGain()
      cg.gain.setValueAtTime(0.0001, t)
      cg.gain.exponentialRampToValueAtTime(0.09, t + 0.03)
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
      const trem = ctx.createOscillator()
      trem.frequency.value = 12
      const tremG = ctx.createGain()
      tremG.gain.value = 0.05
      trem.connect(tremG).connect(cg.gain)
      carrier.connect(cg).connect(out)
      carrier.start(t)
      trem.start(t)
      carrier.stop(t + 0.4)
      trem.stop(t + 0.4)
      return
    }

    // "gel": smooth pitched slurp through an opening lowpass
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(freq * 0.8, t)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.15, t + 0.14)
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.setValueAtTime(500, t)
    lp.frequency.exponentialRampToValueAtTime(2400, t + 0.16)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
    osc.connect(lp).connect(g).connect(out)
    osc.start(t)
    osc.stop(t + 0.26)
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
