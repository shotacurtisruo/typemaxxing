import { useGame } from "../game/store"
import { objectFor, wordCenter, wordRotationY } from "../game/config"
import WordObject from "./WordObject"

/** Each word of the current passage is one continuous platform on the word-spiral. */
export default function Tower() {
  const words = useGame((s) => s.words)
  const baseWord = useGame((s) => s.baseWord)
  const curWi = useGame((s) => s.wi)
  const ci = useGame((s) => s.ci)
  const seed = useGame((s) => s.seed)

  return (
    <group>
      {words.map((word, wi) => {
        const W = baseWord + wi
        const [x, y, z] = wordCenter(W)
        return (
          <group key={W} position={[x, y, z]} rotation={[0, wordRotationY(W), 0]}>
            <WordObject
              object={objectFor(W + seed)}
              word={word}
              variant="long"
              caret={wi === curWi ? ci : -1}
              crossed={wi < curWi}
            />
          </group>
        )
      })}
    </group>
  )
}
