import { useRef, type ReactNode } from "react"
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react"

/**
 * Magnetic hover: the child drifts a fraction of the cursor's offset from
 * the element's centre while hovered, and springs back on leave. No-op under
 * prefers-reduced-motion or on coarse pointers (pointermove barely fires).
 */
export function Magnetic({
  children,
  strength = 0.22,
  className,
}: {
  children: ReactNode
  strength?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 280, damping: 18, mass: 0.5 })
  const sy = useSpring(y, { stiffness: 280, damping: 18, mass: 0.5 })

  const onMove = (e: React.PointerEvent) => {
    if (reduced || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * strength)
    y.set((e.clientY - (r.top + r.height / 2)) * strength)
  }

  const reset = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: sx, y: sy, display: "inline-block" }}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      {children}
    </motion.div>
  )
}
