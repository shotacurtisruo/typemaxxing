import { useEffect, useRef } from "react"
import { RoundedBox, Text } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import type { Group } from "three"
import { positionFor, type Material } from "../game/config"

interface Props {
  worldIndex: number
  char: string
  material: Material
  isNext: boolean
  landedIndex: number
}

const CAP_H = 0.5

export default function Keycap({ worldIndex, char, material, isNext, landedIndex }: Props) {
  const group = useRef<Group>(null)
  const impact = useRef(0)
  const wasLanded = useRef(false)
  const pos = positionFor(worldIndex)
  const isSpace = char === " "
  const climbed = worldIndex <= landedIndex

  // Trigger a squash when the blob lands on this cap.
  useEffect(() => {
    const landed = worldIndex === landedIndex
    if (landed && !wasLanded.current) impact.current = 1
    wasLanded.current = landed
  }, [landedIndex, worldIndex])

  useFrame((_, dt) => {
    if (!group.current) return
    impact.current = Math.max(0, impact.current - dt * 4)
    const squash = impact.current
    group.current.scale.set(1 + squash * 0.18, 1 - squash * 0.3, 1 + squash * 0.18)
    // gentle bob for the upcoming cap so the player sees the target
    const bob = isNext ? Math.sin(performance.now() / 300) * 0.04 : 0
    group.current.position.y = pos[1] + bob
  })

  return (
    <group ref={group} position={pos}>
      <RoundedBox
        args={isSpace ? [2.1, CAP_H, 1.15] : [1.15, CAP_H, 1.15]}
        radius={0.12}
        smoothness={4}
      >
        <meshPhysicalMaterial
          color={material.color}
          roughness={material.roughness}
          metalness={0}
          transmission={material.transmission}
          thickness={0.6}
          ior={1.3}
          clearcoat={material.transmission > 0 ? 1 : 0.3}
          clearcoatRoughness={0.15}
          emissive={isNext ? material.color : "#000000"}
          emissiveIntensity={isNext ? 0.4 : climbed ? 0.05 : 0}
        />
      </RoundedBox>
      {!isSpace && (
        <Text
          position={[0, CAP_H / 2 + 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.5}
          color="#2b2038"
          anchorX="center"
          anchorY="middle"
        >
          {char}
        </Text>
      )}
    </group>
  )
}
