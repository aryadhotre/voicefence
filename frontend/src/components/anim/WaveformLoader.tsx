import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

const BARS = [0.45, 0.7, 1, 0.6, 0.85, 1, 0.55, 0.75, 0.5]

/**
 * Audio-themed loading indicator: a row of waveform bars pulsing in a wave.
 * Under prefers-reduced-motion the bars render static at mid height.
 */
export function WaveformLoader({ className }: { className?: string }) {
  const reduced = useReducedMotion()

  return (
    <div className={cn("flex h-10 items-center gap-1", className)} role="status" aria-label="Analyzing audio">
      {BARS.map((peak, i) => (
        <motion.span
          key={i}
          className="w-1.5 rounded-full bg-violet-400"
          style={{ height: "100%", originY: 0.5 }}
          animate={
            reduced
              ? { scaleY: 0.45 }
              : { scaleY: [0.25, peak, 0.25] }
          }
          transition={
            reduced
              ? { duration: 0 }
              : {
                  duration: 0.9,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.08,
                }
          }
        />
      ))}
    </div>
  )
}
