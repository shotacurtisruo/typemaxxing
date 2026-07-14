import { useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import type { Group } from "three"
import { OBJECTS } from "../game/config"
import WordObject, { GAP, type Variant } from "./WordObject"

function MiniBlob() {
  return (
    <mesh>
      <icosahedronGeometry args={[0.32, 4]} />
      <meshPhysicalMaterial color="#5ff0d0" roughness={0.05} transmission={0.55} thickness={1} ior={1.35} clearcoat={1} clearcoatRoughness={0.1} />
    </mesh>
  )
}

const WORDS = ["hi", "type", "follow", "keyboard"]

function Stage({ objIndex, variant, word }: { objIndex: number; variant: Variant; word: string }) {
  const spin = useRef<Group>(null)
  const object = OBJECTS[objIndex]
  const L = word.length * GAP
  const fit = Math.min(1, 7.5 / Math.max(L, 3))

  useFrame(() => {
    if (spin.current) spin.current.rotation.y = Math.sin(performance.now() / 2600) * 0.35
  })

  return (
    <group scale={fit}>
      <group ref={spin} rotation={[0.15, 0, 0]}>
        <WordObject object={object} word={word} variant={variant} />
        {/* a mini blob at the start to show scale + the "run across" idea */}
        <group position={[(-(word.length - 1) / 2) * GAP, object.halfHeight + 0.4, 0]}>
          <MiniBlob />
        </group>
      </group>
    </group>
  )
}

export default function DesignLab() {
  const [objIndex, setObjIndex] = useState(1) // start on jelly (keycap already chosen)
  const [variant, setVariant] = useState<Variant>("segmented")
  const [word, setWord] = useState("follow")
  const object = useMemo(() => OBJECTS[objIndex], [objIndex])

  return (
    <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(180deg,#eef3ff 0%,#f4edff 55%,#fff2f6 100%)" }}>
      <div className="gallery-title">THOCK · design lab</div>
      <div className="lab-sub">one word = one object · blob runs across → jumps on space</div>

      <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 1.4, 8], fov: 42 }}>
        <ambientLight intensity={0.9} />
        <hemisphereLight args={["#ffffff", "#d8c9ff", 0.6]} />
        <directionalLight position={[5, 8, 6]} intensity={1.3} />
        <pointLight position={[-6, 2, 4]} intensity={28} color="#ffb0da" distance={30} />
        <pointLight position={[6, -3, 4]} intensity={24} color="#9fe6ff" distance={30} />
        <Stage objIndex={objIndex} variant={variant} word={word} />
      </Canvas>

      <div className="lab-panel">
        <div className="lab-row">
          {OBJECTS.map((o, i) => (
            <button key={o.name} className={`lab-chip ${i === objIndex ? "on" : ""}`} onClick={() => setObjIndex(i)}>
              {o.name}
            </button>
          ))}
        </div>
        <div className="lab-row">
          <span className="lab-label">shape</span>
          {(["segmented", "long"] as Variant[]).map((v) => (
            <button key={v} className={`lab-chip ${v === variant ? "on" : ""}`} onClick={() => setVariant(v)}>
              {v === "segmented" ? (object.shape === "keycap" ? "keyboard (segmented)" : "row (segmented)") : "one long piece"}
            </button>
          ))}
          <span className="lab-label" style={{ marginLeft: 18 }}>word</span>
          {WORDS.map((w) => (
            <button key={w} className={`lab-chip ${w === word ? "on" : ""}`} onClick={() => setWord(w)}>
              {w}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
