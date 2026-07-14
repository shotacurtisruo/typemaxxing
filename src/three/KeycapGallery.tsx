import { useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Text } from "@react-three/drei"
import type { Group } from "three"
import KeycapModel, { CAPS, type Cap } from "./KeycapModel"

function Item({ cap, x, y }: { cap: Cap; x: number; y: number }) {
  const spin = useRef<Group>(null)
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.6
  })
  return (
    <group position={[x, y, 0]}>
      <group ref={spin} scale={1.15}>
        <KeycapModel cap={cap} />
      </group>
      <Text position={[0, -0.95, 0]} fontSize={0.26} color="#2b2038" anchorX="center" anchorY="middle">
        {cap.name}
      </Text>
      <Text position={[0, -1.28, 0]} fontSize={0.15} color="#7a7196" anchorX="center" anchorY="middle">
        {cap.tone}
      </Text>
    </group>
  )
}

export default function KeycapGallery() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: "linear-gradient(180deg, #eef3ff 0%, #f4edff 55%, #fff2f6 100%)",
      }}
    >
      <div className="gallery-title">THOCK · keycap profiles</div>
      <div style={{ position: "absolute", top: 44, left: 24, zIndex: 2, fontFamily: "var(--mono)", fontSize: 12, letterSpacing: 2, color: "rgba(58,47,79,0.45)" }}>
        top row = thocky · bottom row = creamy
      </div>
      <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 0, 10.5], fov: 42 }}>
        <ambientLight intensity={0.9} />
        <hemisphereLight args={["#ffffff", "#d8c9ff", 0.6]} />
        <directionalLight position={[5, 8, 6]} intensity={1.3} />
        <pointLight position={[-6, 2, 4]} intensity={30} color="#ffb0da" distance={30} />
        <pointLight position={[6, -3, 4]} intensity={26} color="#9fe6ff" distance={30} />
        <pointLight position={[0, 6, -4]} intensity={22} color="#c3a0ff" distance={30} />
        {CAPS.map((cap, i) => {
          const col = i % 3
          const row = Math.floor(i / 3)
          return <Item key={cap.key} cap={cap} x={(col - 1) * 3.0} y={row === 0 ? 1.7 : -1.7} />
        })}
      </Canvas>
    </div>
  )
}
