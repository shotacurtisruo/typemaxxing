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
        const typedCount = wi < curWi ? word.length : wi === curWi ? ci : 0
        const blobSlot = wi === curWi ? Math.min(ci, word.length - 1) : -1
        return (
          <group key={W} position={[x, y, z]} rotation={[0, wordRotationY(W), 0]}>
            <WordObject object={objectFor(W)} word={word} variant="segmented" blobSlot={blobSlot} typedCount={typedCount} />
          </group>
        )
      })}
    </group>
  )
}
