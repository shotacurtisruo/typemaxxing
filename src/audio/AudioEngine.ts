import { freqFor, type Impact, type MaterialSound } from "../game/config"

/**
 * Web Audio synthesis engine — the soul of typemaxxing.
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
  private mechBus: GainNode | null = null // switch-thock layer volume
  private matBus: GainNode | null = null // material-squish layer volume

  // settings-driven mix (all default to the pre-settings behaviour)
  private masterVolume = 0.9
  private muted = false
  private reverbScale = 1 // reverb slider / 0.5 default
  private ambScale = 1 // ambience slider / 0.6 default
  private stereoWidth = 1
  private lastFlow = 0

  // --- recorded-sample layer (optional; synth is the fallback) ---
  // A decoded CC0 sample per material/keycap tone. When present, it PLAYS
  // instead of the synthesized version, pitched via playbackRate to keep the
  // rising-pentatonic melody. Absent → the procedural synth is used.
  private samples: Record<string, AudioBuffer> = {}
  private sampleGain: Record<string, number> = {}
  private sampleBase: Record<string, number> = {} // reference freq each sample was recorded at
  private sampleOffset: Record<string, number> = {} // start offset into the clip (s)
  private sampleDur: Record<string, number> = {} // play only this many seconds (0 = whole clip)

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
    this.master.gain.value = this.muted ? 0 : this.masterVolume
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

    // per-layer buses so the mechanical and material volumes are independent;
    // each feeds the dry path and the reverb send.
    this.mechBus = ctx.createGain()
    this.matBus = ctx.createGain()
    for (const bus of [this.mechBus, this.matBus]) {
      bus.connect(this.dry)
      bus.connect(this.reverb)
    }

    this.noiseBuf = this.makeNoise(0.4)
    this.startAmbience()
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : this.masterVolume, this.ctx.currentTime, 0.05)
    }
  }

  setMasterVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1, v))
    if (this.master && this.ctx && !this.muted) {
      this.master.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05)
    }
  }

  setMechVolume(v: number) {
    if (this.mechBus && this.ctx) this.mechBus.gain.setTargetAtTime(Math.max(0, v), this.ctx.currentTime, 0.05)
  }

  setMaterialVolume(v: number) {
    if (this.matBus && this.ctx) this.matBus.gain.setTargetAtTime(Math.max(0, v), this.ctx.currentTime, 0.05)
  }

  setReverbAmount(a: number) {
    this.reverbScale = Math.max(0, a) / 0.5 // 0.5 slider == prior default
    this.setFlow(this.lastFlow)
  }

  setStereoWidth(w: number) {
    this.stereoWidth = Math.max(0, Math.min(1, w))
  }

  setAmbienceVolume(v: number) {
    this.ambScale = Math.max(0, v) / 0.6 // 0.6 slider == prior default
    if (this.ambienceGain && this.ctx) {
      this.ambienceGain.gain.setTargetAtTime(this.ambBase * this.ambScale, this.ctx.currentTime, 0.4)
    }
  }

  /** Apply the persisted audio settings in one call (idempotent, ctx-safe). */
  applyAudioSettings(s: {
    masterVolume: number
    mechVolume: number
    materialVolume: number
    ambienceVolume: number
    reverb: number
    stereoWidth: number
    muted: boolean
  }) {
    this.setMasterVolume(s.masterVolume)
    this.setMechVolume(s.mechVolume)
    this.setMaterialVolume(s.materialVolume)
    this.setAmbienceVolume(s.ambienceVolume)
    this.setReverbAmount(s.reverb)
    this.setStereoWidth(s.stereoWidth)
    this.setMuted(s.muted)
  }

  /**
   * Load CC0 samples listed in /sounds/manifest.json. Each entry:
   *   { "key": "honey", "file": "honey.mp3", "gain": 0.9, "baseFreq": 261.63 }
   * `key` is a MaterialSound ("squish","honey",…) or a keycap tone ("mt3"/"xda").
   * Missing files fail silently — that material keeps its synth voice. Safe to
   * call before start(): it decodes lazily once the AudioContext exists.
   */
  async loadManifest(url = "/sounds/manifest.json") {
    let list: { key: string; file: string; gain?: number; baseFreq?: number; offset?: number; dur?: number }[]
    try {
      const res = await fetch(url)
      if (!res.ok) return
      list = await res.json()
    } catch {
      return
    }
    if (!this.ctx) this.start()
    const base = url.slice(0, url.lastIndexOf("/") + 1)
    await Promise.all(
      list.map(async (e) => {
        try {
          const res = await fetch(base + e.file)
          if (!res.ok) return
          const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer())
          this.samples[e.key] = buf
          this.sampleGain[e.key] = e.gain ?? 1
          this.sampleBase[e.key] = e.baseFreq ?? 261.63 // C4 default
          this.sampleOffset[e.key] = e.offset ?? 0
          this.sampleDur[e.key] = e.dur ?? 0
        } catch {
          /* leave this material on synth */
        }
      })
    )
  }

  /** Play a loaded sample, pitched toward `freq` (gently, so it never chipmunks). */
  private playSample(key: string, freq: number, pan: number) {
    const ctx = this.ctx!
    const buf = this.samples[key]
    const src = ctx.createBufferSource()
    src.buffer = buf
    // map the melody onto playbackRate but clamp so texture stays natural
    const ratio = freq / (this.sampleBase[key] || 261.63)
    src.playbackRate.value = Math.min(1.35, Math.max(0.75, ratio))
    const g = ctx.createGain()
    g.gain.value = this.sampleGain[key] ?? 1
    src.connect(g).connect(this.pan(pan, true, this.matBus))
    const offset = this.sampleOffset[key] ?? 0
    const dur = this.sampleDur[key] ?? 0
    if (dur > 0) src.start(ctx.currentTime, offset, dur)
    else src.start(ctx.currentTime, offset)
  }

  /** Flow (0..1) opens up reverb + ambience for a warmer, deeper mix. */
  setFlow(flow: number) {
    if (!this.ctx) return
    this.lastFlow = flow
    const t = this.ctx.currentTime
    this.wet.gain.setTargetAtTime((0.06 + flow * 0.3) * this.reverbScale, t, 0.2)
    if (this.ambienceGain) this.ambienceGain.gain.setTargetAtTime((this.ambBase + flow * 0.04) * this.ambScale, t, 0.4)
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
    if (this.samples[sound]) {
      // recorded material sample replaces the synth voice; keep the light impact tick underneath
      this.playImpact(impact, freq, pan)
      this.playSample(sound, freq, pan)
    } else {
      this.playImpact(impact, freq, pan)
      this.playMaterial(sound, freq, pan)
    }
    this.setFlow(flow)
  }

  /** A keycap keystroke with the selected switch tone. */
  playKeycap(tone: "mt3" | "xda", pitch: number, pan: number, flow: number) {
    const ctx = this.ctx
    if (!ctx) return
    const freq = freqFor(pitch)
    // recorded switch sample (if provided for this tone) replaces the synth thock
    if (this.samples[tone]) {
      this.playSample(tone, freq, pan)
      this.setFlow(flow)
      return
    }
    const t = ctx.currentTime
    const out = this.pan(pan, true, this.mechBus)

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

  /** Picking up a coin: a bright two-note chime (classic collectible blip). */
  playCoin(pan = 0) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const out = this.pan(pan, true)
    const notes = [1318.5, 1975.5] // E6 → B6
    notes.forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = "square"
      o.frequency.value = f
      const g = ctx.createGain()
      const ts = t + i * 0.07
      g.gain.setValueAtTime(0.0001, ts)
      g.gain.exponentialRampToValueAtTime(0.1, ts + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.13)
      o.connect(g).connect(out)
      o.start(ts)
      o.stop(ts + 0.15)
    })
    // a soft sparkle on top
    this.noiseBurst(out, t + 0.02, { type: "highpass", freq: 6000, gain: 0.04, decay: 0.05 })
  }

  /** A fresh crack forming in ice on landing: a brittle propagating micro-crackle. */
  playCrack(pan = 0) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const out = this.pan(pan, true)
    // a few rapid brittle ticks — the crack propagating through the crystal
    ;[0, 0.013, 0.031].forEach((dt, i) => {
      this.noiseBurst(out, t + dt, { type: "highpass", freq: 4200 + i * 900, gain: 0.12 - i * 0.03, decay: 0.012 })
    })
    // a tiny glassy ping riding on top
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(2700, t)
    osc.frequency.exponentialRampToValueAtTime(2200, t + 0.05)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.045, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    osc.connect(g).connect(out)
    osc.start(t)
    osc.stop(t + 0.07)
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
    const out = this.pan(pan, true, this.mechBus)

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
    const out = this.pan(pan, true, this.matBus)

    if (sound === "foam") {
      // soft filtered-noise crunch, mostly unpitched
      this.noiseBurst(out, t, { type: "bandpass", freq: freq * 3, Q: 1.5, gain: 0.16, attack: 0.008, decay: 0.11 })
      return
    }

    if (sound === "marsh") {
      // marshmallow: a soft PUSHY compression — a muffled low "poomf" as the
      // foam gives way. No squeak, no squish, no wetness.
      this.noiseBurst(out, t, { type: "lowpass", freq: 420, gain: 0.13, attack: 0.025, decay: 0.17 })
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.setValueAtTime(Math.max(95, freq * 0.5), t)
      osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.32), t + 0.14) // the soft give
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.13, t + 0.025)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      osc.connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 0.22)
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
      // stepping on hard cold butter: a THONK (woody resonant knock) that snaps
      // straight into a dry CRACK as the slab fractures underfoot.
      const dry = this.pan(pan, false)
      // (1) thonk — punchy woody low-mid resonant body, fast tight decay
      const body = ctx.createOscillator()
      body.type = "sine"
      body.frequency.setValueAtTime(Math.max(150, freq * 0.5), t)
      body.frequency.exponentialRampToValueAtTime(Math.max(84, freq * 0.32), t + 0.09)
      const bp = ctx.createBiquadFilter()
      bp.type = "bandpass"
      bp.frequency.value = 165
      bp.Q.value = 4
      const bg = ctx.createGain()
      bg.gain.setValueAtTime(0.0001, t)
      bg.gain.exponentialRampToValueAtTime(0.32, t + 0.005)
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
      body.connect(bp).connect(bg).connect(out)
      body.start(t)
      body.stop(t + 0.14)
      // (2) woody knock transient — the "t" of the thonk
      this.noiseBurst(out, t, { type: "bandpass", freq: 1150, Q: 1.4, gain: 0.14, attack: 0.001, decay: 0.03 })
      // (3) the crack — a sharp dry fracture snapping right after the knock
      this.noiseBurst(dry, t + 0.008, { type: "bandpass", freq: 2300, Q: 2.4, gain: 0.16, decay: 0.016 })
      this.noiseBurst(dry, t + 0.028, { type: "bandpass", freq: 3200, Q: 2.6, gain: 0.1, decay: 0.012 })
      this.noiseBurst(dry, t + 0.05, { type: "bandpass", freq: 2700, Q: 2.2, gain: 0.06, decay: 0.01 })
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
  private pan(x: number, sendReverb: boolean, bus?: GainNode | null): AudioNode {
    const ctx = this.ctx!
    const p = ctx.createPanner()
    p.panningModel = "HRTF"
    p.distanceModel = "linear"
    p.positionX.value = x * 2 * this.stereoWidth
    p.positionY.value = 0
    p.positionZ.value = -1.2
    if (bus) {
      p.connect(bus) // bus already routes to dry + reverb
    } else {
      p.connect(this.dry)
      if (sendReverb) p.connect(this.reverb)
    }
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
