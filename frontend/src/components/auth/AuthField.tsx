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
      <span className="text-[13px] font-medium text-white/50">{label}</span>
      <input
        className={cn(
          "rounded-lg border border-white/12 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/25 transition-colors focus:border-violet-400/60 focus:outline-none",
          error && "border-rose-500/50",
          className
        )}
        {...props}
      />
    </label>
  )
}
