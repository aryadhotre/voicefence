import { useEffect } from "react"
import { motion, useSpring, useReducedMotion } from "motion/react"
import { SpecCell } from "@/components/ui/dossier"
import { RadialGauge } from "@/components/anim/RadialGauge"
import { cn } from "@/lib/utils"

/**
 * Browser-chrome mockup of the real Analyze results panel, for the landing
 * page. Built from the same primitives the actual product uses (SpecCell,
 * RadialGauge, the window-score bar chart pattern) with representative
 * static values — so it stays visually truthful to what /analyze renders,
 * rather than being a fake screenshot that drifts out of date.
 */

// Representative window scores from a real spoof-like analysis: most
// windows below threshold, a couple near it — the shape users actually see.
const PREVIEW_SCORES = [-5.4, -6.1, -4.2, -2.8, -5.9, -6.3, -3.4, -1.1, -4.8, -5.5, -2.2, -6.0]
const PREVIEW_THRESHOLD = -3.92
const PREVIEW_MEAN = -4.48

// Same visual normalization the product uses for its gauges.
const GAUGE_MIN = -10
const GAUGE_MAX = 10
const normalize = (s: number) => Math.min(1, Math.max(0, (s - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)))

export function ProductPreview({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn("relative", className)}
      initial={{ opacity: 0, y: 32, rotateX: 6 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 2 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
      style={{ transformPerspective: 1200 }}
    >
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0a16] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.7),0_0_60px_-12px_rgba(124,92,255,0.15)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </span>
          <span className="mx-auto rounded-md bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-white/40">
            voicefence.vercel.app/analyze
          </span>
          <span className="w-12" aria-hidden />
        </div>

        {/* Report body — mirrors the real /analyze results panel */}
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-white/35">
              Analysis report
            </span>
            <span className="rounded-md border border-rose-400/50 px-2.5 py-1 text-xs font-semibold text-rose-300">
              Spoof-like
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
            <PreviewGauge />
            <div className="grid flex-1 grid-cols-3 gap-4">
              <SpecCell label="Duration" value="49.2s" />
              <SpecCell label="Windows" value={PREVIEW_SCORES.length} />
              <SpecCell label="Threshold" value={PREVIEW_THRESHOLD.toFixed(2)} />
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
              Per-window score timeline
            </p>
            <PreviewChart />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function PreviewGauge() {
  const reduced = useReducedMotion()
  const progress = useSpring(0, { stiffness: 55, damping: 15, mass: 1 })

  useEffect(() => {
    const target = normalize(PREVIEW_MEAN)
    if (reduced) progress.jump(target)
    else progress.set(target)
  }, [progress, reduced])

  return (
    <RadialGauge
      progress={progress}
      stroke="#fb7185"
      marker={normalize(PREVIEW_THRESHOLD)}
      className="h-28 w-28 shrink-0"
    >
      <span className="font-mono text-lg font-bold text-rose-200">
        {PREVIEW_MEAN.toFixed(2)}
      </span>
      <span className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-white/35">
        mean score
      </span>
    </RadialGauge>
  )
}

function PreviewChart() {
  const all = [...PREVIEW_SCORES, PREVIEW_THRESHOLD]
  const max = Math.max(...all, 1)
  const min = Math.min(...all, -1)
  const range = max - min || 1
  const thresholdPct = ((max - PREVIEW_THRESHOLD) / range) * 100

  return (
    <div className="relative h-24 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
      <div
        className="absolute left-2.5 right-2.5 border-t border-dashed border-white/25"
        style={{ top: `${thresholdPct}%` }}
      />
      <div className="flex h-full items-end gap-1">
        {PREVIEW_SCORES.map((s, i) => {
          const heightPct = ((s - min) / range) * 100
          const spoof = s < PREVIEW_THRESHOLD
          return (
            <motion.div
              key={i}
              className={cn(
                "flex-1 rounded-sm",
                spoof ? "bg-rose-400/70" : "bg-emerald-400/70"
              )}
              style={{ height: `${Math.max(heightPct, 3)}%`, originY: 1 }}
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.04, type: "spring", stiffness: 260, damping: 22 }}
            />
          )
        })}
      </div>
    </div>
  )
}
