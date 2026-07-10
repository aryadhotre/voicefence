import { Suspense, lazy } from "react"
import { useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

// three + fiber + drei are ~1MB of JS the landing page shouldn't pay for
// before first paint — lazy-load the scene; the CSS glow renders instantly
// and doubles as the loading state and the WebGL-failure fallback.
const HeroScene = lazy(() => import("./HeroScene"))

export function HeroVisual({ className }: { className?: string }) {
  const reduced = useReducedMotion()

  return (
    <div className={cn("relative", className)}>
      <div
        aria-hidden
        className="glow-radial absolute inset-[-18%] -z-10"
      />
      <Suspense fallback={null}>
        <HeroScene animate={!reduced} />
      </Suspense>
    </div>
  )
}
