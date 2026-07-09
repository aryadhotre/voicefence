import type { ReactNode } from "react"
import { motion, type MotionValue } from "motion/react"
import { cn } from "@/lib/utils"

const START_ANGLE = -135
const SWEEP = 270

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, r, startAngle)
  const end = polar(cx, cy, r, endAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`
}

/**
 * A 270° radial gauge whose fill is driven by a MotionValue in [0, 1] via
 * SVG pathLength — pass a spring-smoothed value for the springy sweep.
 * `stroke` may be a plain color or a MotionValue<string> for live color
 * interpolation. `marker` (0..1) draws a fixed tick, e.g. the threshold.
 */
export function RadialGauge({
  progress,
  stroke,
  marker,
  strokeWidth = 7,
  className,
  children,
}: {
  progress: MotionValue<number>
  stroke: MotionValue<string> | string
  marker?: number
  strokeWidth?: number
  className?: string
  children?: ReactNode
}) {
  const r = 50 - strokeWidth / 2 - 1
  const track = arcPath(50, 50, r, START_ANGLE, START_ANGLE + SWEEP)
  const markerAngle = marker != null ? START_ANGLE + marker * SWEEP : null

  return (
    <div className={cn("relative", className)}>
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <path
          d={track}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <motion.path
          d={track}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ pathLength: progress, stroke }}
        />
        {markerAngle != null && (
          <MarkerTick angle={markerAngle} r={r} strokeWidth={strokeWidth} />
        )}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  )
}

function MarkerTick({ angle, r, strokeWidth }: { angle: number; r: number; strokeWidth: number }) {
  const inner = polar(50, 50, r - strokeWidth / 2 - 1.5, angle)
  const outer = polar(50, 50, r + strokeWidth / 2 + 1.5, angle)
  return (
    <line
      x1={inner.x}
      y1={inner.y}
      x2={outer.x}
      y2={outer.y}
      stroke="rgba(255,255,255,0.55)"
      strokeWidth={1.2}
      strokeLinecap="round"
    />
  )
}
