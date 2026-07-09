import { motion } from "motion/react"
import type { ComponentProps } from "react"

type RevealProps = ComponentProps<typeof motion.div> & {
  /** Seconds to wait before starting, for manual stagger between siblings. */
  delay?: number
  /** Initial vertical offset in px. */
  y?: number
}

/**
 * Fade-and-rise wrapper that plays once when scrolled into view
 * (IntersectionObserver via whileInView). Under prefers-reduced-motion the
 * MotionConfig at the app root strips the transform, leaving a plain fade.
 */
export function Reveal({ delay = 0, y = 24, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.21, 0.47, 0.32, 0.98], delay }}
      {...props}
    />
  )
}
