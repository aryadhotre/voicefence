import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Editorial section kicker: index number + mono uppercase label + hairline
 * rule. The recurring wayfinding device of the redesign.
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
    <div className={cn("flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-white/40", className)}>
      {index && <span className="text-violet-400/80">{index}</span>}
      <span>{label}</span>
      <span className="h-px flex-1 bg-white/10" aria-hidden />
    </div>
  )
}

/** Four "+" register marks in the corners of a panel — print/schematic feel. */
export function Ticks({ className }: { className?: string }) {
  const pos = [
    "left-1.5 top-0.5",
    "right-1.5 top-0.5",
    "left-1.5 bottom-0.5",
    "right-1.5 bottom-0.5",
  ]
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {pos.map((p) => (
        <span key={p} className={cn("absolute font-mono text-[10px] leading-none text-white/25", p)}>
          +
        </span>
      ))}
    </span>
  )
}

/** Mono key/value cell used in spec strips and report headers. */
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
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">{label}</span>
      <span className="font-mono text-sm text-white/85">{value}</span>
    </div>
  )
}
