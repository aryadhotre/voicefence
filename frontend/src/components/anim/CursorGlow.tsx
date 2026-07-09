import { useEffect, useState } from "react"
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react"

/**
 * A low-opacity radial glow that trails the cursor across the whole app.
 * Driven entirely by transforms on a fixed element (no layout writes), with
 * the raw mousemove position smoothed through springs. Disabled on coarse
 * pointers and under prefers-reduced-motion.
 */
export function CursorGlow() {
  const reduced = useReducedMotion()
  const [enabled, setEnabled] = useState(false)
  const x = useMotionValue(-600)
  const y = useMotionValue(-600)
  const sx = useSpring(x, { stiffness: 110, damping: 28, mass: 0.7 })
  const sy = useSpring(y, { stiffness: 110, damping: 28, mass: 0.7 })

  useEffect(() => {
    if (reduced || !window.matchMedia("(pointer: fine)").matches) return
    setEnabled(true)
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [reduced, x, y])

  if (!enabled || reduced) return null

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[1] h-[34rem] w-[34rem] rounded-full"
      style={{
        x: sx,
        y: sy,
        translateX: "-50%",
        translateY: "-50%",
        background:
          "radial-gradient(circle, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0.035) 40%, transparent 70%)",
      }}
    />
  )
}
