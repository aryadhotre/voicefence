import { useEffect, useRef } from "react"
import { animate, useInView, useReducedMotion } from "motion/react"

/**
 * Counts up from 0 to `value` the first time the element scrolls into view.
 * Writes to textContent directly so the tween never re-renders React.
 * Under prefers-reduced-motion it renders the final value instantly.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.4,
  className,
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || !inView) return
    if (reduced) {
      el.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`
      return
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = `${prefix}${v.toFixed(decimals)}${suffix}`
      },
    })
    return () => controls.stop()
  }, [inView, value, decimals, prefix, suffix, duration, reduced])

  return (
    <span ref={ref} className={className}>
      {`${prefix}${(0).toFixed(decimals)}${suffix}`}
    </span>
  )
}
