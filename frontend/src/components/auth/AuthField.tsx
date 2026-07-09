import type { InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function AuthField({
  label,
  error,
  className,
  ...props
}: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">
        {label}
      </span>
      <input
        className={cn(
          "border border-white/15 bg-white/[0.02] px-4 py-3 font-mono text-sm text-white placeholder:text-white/25 transition-colors focus:border-violet-400/60 focus:outline-none",
          error && "border-rose-500/50",
          className
        )}
        {...props}
      />
    </label>
  )
}
