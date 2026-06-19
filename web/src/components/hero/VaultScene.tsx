import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, MeshTransmissionMaterial, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

/** A small refractive crystal — stands in for a "token" suspended in the vault. */
function Crystal({ position, tint, scale = 1 }: { position: [number, number, number]; tint: string; scale?: number }) {
  return (
    <Float speed={1.4} rotationIntensity={1.1} floatIntensity={1.3}>
      <mesh position={position} scale={scale}>
        <octahedronGeometry args={[0.42, 0]} />
        <meshPhysicalMaterial
          color={tint}
          transmission={0.6}
          thickness={0.8}
          roughness={0.18}
          metalness={0}
          ior={1.5}
          emissive={tint}
          emissiveIntensity={0.18}
          transparent
          opacity={0.92}
        />
      </mesh>
    </Float>
  );
}

/** The vault slab: a thick, gently-rotating refractive panel — the heart of the scene. */
function Slab({ position }: { position?: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    const { x, y } = state.pointer;
    // ease the slab toward a subtle tilt that follows the cursor (diorama feel)
    group.current.rotation.y += (x * 0.32 - group.current.rotation.y) * 0.04;
    group.current.rotation.x += (-y * 0.22 - group.current.rotation.x) * 0.04;
  });
  return (
    <group ref={group} position={position}>
      <RoundedBox args={[2.7, 3.5, 0.42]} radius={0.18} smoothness={6}>
        <MeshTransmissionMaterial
          samples={6}
          resolution={256}
          transmission={1}
          thickness={1.1}
          roughness={0.12}
          ior={1.42}
          chromaticAberration={0.06}
          anisotropy={0.3}
          distortion={0.2}
          distortionScale={0.35}
          temporalDistortion={0.1}
          attenuationColor="#cdd6e6"
          attenuationDistance={2.4}
          color="#dfe6f2"
        />
      </RoundedBox>
    </group>
  );
}

function SceneContents() {
  return (
    <>
      <ambientLight intensity={0.35} />
      {/* warm key light from top-center */}
      <spotLight position={[0, 6, 4]} angle={0.6} penumbra={1} intensity={50} color="#f0dcb4" distance={22} />
      <pointLight position={[-4, 2, 3]} intensity={12} color="#8fa0c0" />

      <Float speed={0.8} rotationIntensity={0.25} floatIntensity={0.6}>
        <Slab position={[0, 0, 0]} />
      </Float>

      <Crystal position={[-2.1, 1.1, 1.3]} tint="#B197D6" scale={0.9} />
      <Crystal position={[2.2, -0.6, 0.9]} tint="#DCB87E" scale={1.05} />
      <Crystal position={[1.7, 1.6, -0.4]} tint="#5FB3A8" scale={0.7} />

      {/* custom environment (Lightformers, no network HDR) drives the glass refractions */}
      <Environment resolution={256}>
        <Lightformer intensity={2.2} position={[0, 3, 2]} scale={[6, 3, 1]} color="#f3e6c8" />
        <Lightformer intensity={1.1} position={[-3, 0, 2]} scale={[3, 5, 1]} color="#9fb0d0" />
        <Lightformer intensity={0.8} position={[3, -1, 1]} scale={[3, 4, 1]} color="#cdd6e6" />
      </Environment>
    </>
  );
}

/** Lazy-loaded WebGL hero (desktop, motion-on only). Default export for React.lazy. */
export default function VaultScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 38 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%" }}
    >
      <SceneContents />
    </Canvas>
  );
}
