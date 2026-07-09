import { useRef, type ReactNode } from "react"
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useSpring,
  useReducedMotion,
} from "motion/react"
import { cn } from "@/lib/utils"

/**
 * Card with a cursor-follow spotlight glow and a subtle 3D tilt on hover.
 * Spotlight position and tilt are motion values (transform/background only,
 * no layout writes). Tilt and scale are skipped under prefers-reduced-motion;
 * the spotlight stays put at rest so nothing moves.
 */
export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(139, 92, 246, 0.14)",
}: {
  children: ReactNode
  className?: string
  spotlightColor?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  const mx = useMotionValue(-300)
  const my = useMotionValue(-300)
  const rotateX = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 })
  const rotateY = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 })

  const spotlight = useMotionTemplate`radial-gradient(260px circle at ${mx}px ${my}px, ${spotlightColor}, transparent 70%)`

  const onMove = (e: React.PointerEvent) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    mx.set(px)
    my.set(py)
    if (!reduced) {
      rotateX.set(-((py / r.height) - 0.5) * 5)
      rotateY.set(((px / r.width) - 0.5) * 5)
    }
  }

  const onLeave = () => {
    mx.set(-300)
    my.set(-300)
    rotateX.set(0)
    rotateY.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      whileHover={reduced ? undefined : { scale: 1.015 }}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10",
        className
      )}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: spotlight }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  )
}
