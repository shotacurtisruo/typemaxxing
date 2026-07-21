import { useEffect, useMemo, useRef } from "react"
import { useGLTF, useAnimations } from "@react-three/drei"
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js"
import type { Group } from "three"
import type { AnimState, ModelSpec } from "../game/skins"

// When a character's GLB is missing a clip for a requested state, fall back down
// this chain until we find one that exists. Mirrors ASSET_STANDARD.md so the
// controller can request any state without the renderer ever crashing.
const FALLBACK: Record<AnimState, AnimState[]> = {
  idle: [],
  walk: ["idle"],
  run: ["walk", "idle"],
  climb: ["walk", "idle"],
  jump: ["walk", "idle"],
  fall: ["jump", "walk", "idle"],
  land: ["idle"],
  defeat: ["fall", "jump", "idle"],
}

export interface CharacterModel {
  scene: Group
  /** Cross-fade to the clip mapped from a logical state (with fallbacks). */
  play: (state: AnimState) => void
}

/**
 * Loads a character GLB and returns its scene + a `play(state)` that cross-fades
 * to the clip the catalog maps that state to. Clip names come from
 * `spec.clips` (data-driven — never hardcoded), and missing clips resolve via
 * the FALLBACK chain, so a partially-animated model still plays.
 *
 * Throws (suspends) while loading — wrap the consumer in <Suspense> + an error
 * boundary that falls back to the pixel sprite.
 */
export function useCharacterModel(spec: ModelSpec): CharacterModel {
  const gltf = useGLTF(spec.path) // cached by URL — the GLB is fetched/decoded ONCE
  // Clone the skinned scene per mount so each equipped instance owns its own
  // skeleton + mixer. Prevents animations stacking or leaking across equip
  // swaps (and keeps the shared cached scene pristine).
  const scene = useMemo(() => cloneSkinned(gltf.scene) as Group, [gltf.scene])
  const group = useRef<Group>(scene)
  const { actions } = useAnimations(gltf.animations, group)
  const current = useRef<string | null>(null)

  // Resolve a logical state to an actual clip name that exists in this GLB.
  const resolve = useMemo(() => {
    return (state: AnimState): string | null => {
      for (const s of [state, ...FALLBACK[state]]) {
        const clip = spec.clips[s]
        if (clip && actions[clip]) return clip
      }
      // last resort: first available clip so the model is never frozen unposed
      const first = Object.keys(actions)[0]
      return first ?? null
    }
  }, [actions, spec.clips])

  const play = useMemo(() => {
    return (state: AnimState) => {
      const name = resolve(state)
      if (!name || name === current.current) return
      const next = actions[name]
      if (!next) return
      const prev = current.current ? actions[current.current] : null
      next.reset().fadeIn(0.18).play()
      if (prev && prev !== next) prev.fadeOut(0.18)
      current.current = name
    }
  }, [actions, resolve])

  // start idling as soon as the model mounts
  useEffect(() => {
    play("idle")
  }, [play])

  return { scene, play }
}
