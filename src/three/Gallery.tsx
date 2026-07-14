import { useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Text } from "@react-three/drei"
import type { Group } from "three"
import { OBJECTS } from "../game/config"
import ObjectMesh from "./ObjectMesh"

function SpinItem({ index }: { index: number }) {
  const spin = useRef<Group>(null)
  const obj = OBJECTS[index]
  const col = index % 3
  const row = Math.floor(index / 3)
  const x = (col - 1) * 2.7
  const y = (1 - row) * 2.5

  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.6
  })

  return (
    <group position={[x, y, 0]}>
      <group ref={spin}>
        <ObjectMesh object={obj} showLetter={false} />
      </group>
      <Text position={[0, -1.05, 0]} fontSize={0.24} color="#3a2f4f" anchorX="center" anchorY="middle">
        {obj.name}
      </Text>
    </group>
  )
}

export default function Gallery() {
  return (
    <div
      className="gallery"
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: "linear-gradient(180deg, #eaf1ff 0%, #f3ecff 55%, #fff2f6 100%)",
      }}
    >
      <div className="gallery-title">THOCK · object gallery</div>
      <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 0, 9.5], fov: 45 }}>
        <ambientLight intensity={0.9} />
        <hemisphereLight args={["#ffffff", "#d8c9ff", 0.6]} />
        <directionalLight position={[5, 8, 6]} intensity={1.3} />
        <pointLight position={[-6, 2, 4]} intensity={30} color="#ffb0da" distance={30} />
        <pointLight position={[6, -3, 4]} intensity={26} color="#9fe6ff" distance={30} />
        <pointLight position={[0, 6, -4]} intensity={22} color="#c3a0ff" distance={30} />
        {OBJECTS.map((_, i) => (
          <SpinItem key={i} index={i} />
        ))}
      </Canvas>
    </div>
  )
}
