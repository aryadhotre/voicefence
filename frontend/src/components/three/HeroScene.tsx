import { Component, useMemo, useRef, type ReactNode } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Float, RoundedBox } from "@react-three/drei"
import type { Group } from "three"

/**
 * Abstract block-cluster hero object (Resend-style): a 3×3×3 lattice of
 * matte rounded cubes with a single glowing violet core, rotating slowly.
 * Deliberately understated — dark matte materials, one emissive accent,
 * no environment-map fetch (plain lights only, so nothing hits the network
 * at runtime).
 */

// Positions for a 3×3×3 lattice with a few corner cubes removed — the
// missing corners break the perfect-cube silhouette so the form reads as
// "assembling/disassembling", not a rubik's toy.
const SPACING = 1.12
const REMOVED = new Set(["1,1,1", "-1,1,1", "1,-1,-1", "-1,-1,1"])

function latticePositions(): [number, number, number][] {
  const cells: [number, number, number][] = []
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1])
      for (const z of [-1, 0, 1]) {
        if (REMOVED.has(`${x},${y},${z}`)) continue
        cells.push([x * SPACING, y * SPACING, z * SPACING])
      }
  return cells
}

// Muted violet-greys; index 13 is the lattice center (0,0,0) — the core.
const SHELL_COLORS = ["#2b2340", "#352a4d", "#3f3260"]

function Cluster({ animate }: { animate: boolean }) {
  const group = useRef<Group>(null)
  const positions = useMemo(latticePositions, [])

  useFrame((_, dt) => {
    if (!animate || !group.current) return
    group.current.rotation.y += dt * 0.16
    group.current.rotation.x += dt * 0.02
  })

  return (
    <group ref={group} rotation={[0.45, 0.7, 0]}>
      {positions.map((p, i) => {
        const isCore = p[0] === 0 && p[1] === 0 && p[2] === 0
        return (
          <RoundedBox key={i} args={[1, 1, 1]} radius={0.09} smoothness={3} position={p}>
            {isCore ? (
              <meshStandardMaterial
                color="#8b6cff"
                emissive="#7c5cff"
                emissiveIntensity={2.2}
                roughness={0.3}
                metalness={0.1}
              />
            ) : (
              <meshStandardMaterial
                color={SHELL_COLORS[i % SHELL_COLORS.length]}
                roughness={0.35}
                metalness={0.45}
              />
            )}
          </RoundedBox>
        )
      })}
    </group>
  )
}

/** Renders nothing if WebGL init or the scene throws — the CSS glow behind
 * the canvas remains, so the hero degrades to a soft light instead of a
 * crash (old devices, headless browsers, GPU-less remoting). */
class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function HeroScene({ animate }: { animate: boolean }) {
  return (
    <SceneErrorBoundary>
      <Canvas
        camera={{ position: [5.2, 3.6, 6.4], fov: 32 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        aria-hidden
      >
        <ambientLight intensity={0.8} />
        {/* Key / fill / violet rim — reads premium without an HDR fetch. */}
        <directionalLight position={[6, 8, 4]} intensity={2.8} color="#ffffff" />
        <directionalLight position={[-6, -2, -4]} intensity={1.1} color="#8b7cf6" />
        <directionalLight position={[0, -6, 6]} intensity={0.6} color="#c4b5fd" />
        <pointLight position={[0, 0, 0]} intensity={5} color="#7c5cff" distance={8} />
        <Float
          enabled={animate}
          speed={1.4}
          floatIntensity={0.55}
          rotationIntensity={0.25}
        >
          <Cluster animate={animate} />
        </Float>
      </Canvas>
    </SceneErrorBoundary>
  )
}
