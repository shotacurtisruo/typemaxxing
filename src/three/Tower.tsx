import { useGame } from "../game/store"
import { objectFor, wordCenter, wordRotationY } from "../game/config"
import WordObject from "./WordObject"

/** Each word of the current passage is one continuous platform on the word-spiral. */
export default function Tower() {
  const words = useGame((s) => s.words)
  const marks = useGame((s) => s.marks)
  const baseWord = useGame((s) => s.baseWord)
  const curWi = useGame((s) => s.wi)
  const ci = useGame((s) => s.ci)

  return (
    <group>
      {words.map((word, wi) => {
        const W = baseWord + wi
        const [x, y, z] = wordCenter(W)
        return (
          <group key={W} position={[x, y, z]} rotation={[0, wordRotationY(W), 0]}>
            <WordObject
              object={objectFor(W)}
              word={word}
              variant="long"
              marks={marks[wi]}
              caret={wi === curWi ? ci : -1}
            />
          </group>
        )
      })}
    </group>
  )
}
