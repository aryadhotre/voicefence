import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Section kicker: a small violet marker + quiet uppercase sans label.
 * The single recurring wayfinding device — deliberately understated so the
 * large sans headlines below it carry the hierarchy.
 */
export function Kicker({
  index,
  label,
  className,
}: {
  index?: string
  label: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.14em] text-white/40",
        className
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-violet-400" />
      <span>{label}</span>
      {index && <span className="sr-only">{index}</span>}
    </div>
  )
}

/**
 * Legacy print-register corner marks from the old dossier look. Kept as a
 * no-op export until every usage is removed, so intermediate commits build.
 */
export function Ticks({ className }: { className?: string }) {
  void className
  return null
}

/**
 * Key/value cell for genuinely technical readouts (scores, durations,
 * thresholds, model specs). The value stays monospace on purpose — this is
 * the one place mono belongs.
 */
export function SpecCell({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
        {label}
      </span>
      <span className="font-mono text-sm tabular-nums text-white/85">{value}</span>
    </div>
  )
}
