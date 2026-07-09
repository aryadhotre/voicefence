import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Continuous horizontal marquee. Content is rendered twice and slid -50% on
 * a CSS keyframe loop (see `.marquee-track` in index.css), pausing on hover.
 * `motion-reduce:` styles stop the animation entirely under
 * prefers-reduced-motion.
 */
export function Marquee({
  children,
  durationSec = 40,
  className,
}: {
  children: ReactNode
  durationSec?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden",
        // fade the edges out so items don't pop in/out hard
        "[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]",
        className
      )}
    >
      <div
        className="marquee-track flex w-max gap-4 group-hover:[animation-play-state:paused]"
        style={{ animationDuration: `${durationSec}s` }}
      >
        <div className="flex shrink-0 gap-4">{children}</div>
        <div className="flex shrink-0 gap-4" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  )
}
