import { useGame } from "../game/store"
import { materialFor } from "../game/config"
import Keycap from "./Keycap"

/** Renders the current passage's keycaps along the spiral (endless via baseOffset). */
export default function Tower() {
  const passage = useGame((s) => s.passage)
  const typed = useGame((s) => s.typed)
  const baseOffset = useGame((s) => s.baseOffset)
  const landedIndex = baseOffset + typed - 1

  return (
    <group>
      {passage.split("").map((char, i) => {
        const worldIndex = baseOffset + i
        return (
          <Keycap
            key={worldIndex}
            worldIndex={worldIndex}
            char={char}
            material={materialFor(worldIndex)}
            isNext={i === typed}
            landedIndex={landedIndex}
          />
        )
      })}
    </group>
  )
}
