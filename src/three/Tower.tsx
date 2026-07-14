import { useGame } from "../game/store"
import { objectFor, wordCenter, wordRotationY } from "../game/config"
import WordObject from "./WordObject"

/** Each word of the current passage becomes one object on the word-spiral. */
export default function Tower() {
  const words = useGame((s) => s.words)
  const baseWord = useGame((s) => s.baseWord)
  const curWi = useGame((s) => s.wi)
  const ci = useGame((s) => s.ci)

  return (
    <group>
      {words.map((word, wi) => {
        const W = baseWord + wi
        const [x, y, z] = wordCenter(W)
        // progress coloring: past words fully lit, current word up to the caret, future words dark
        const activeIndex = wi < curWi ? word.length : wi === curWi ? ci : -1
        return (
          <group key={W} position={[x, y, z]} rotation={[0, wordRotationY(W), 0]}>
            <WordObject object={objectFor(W)} word={word} variant="segmented" activeIndex={activeIndex} />
          </group>
        )
      })}
    </group>
  )
}
