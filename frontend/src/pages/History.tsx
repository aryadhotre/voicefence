import { useEffect, useState } from "react"
import { AlertTriangle, FileAudio, Radio } from "lucide-react"
import { motion } from "motion/react"
import { Kicker, SpecCell } from "@/components/ui/dossier"
import { supabase } from "@/lib/supabase"
import type { AnalysisHistoryRow } from "@/lib/history"
import { cn } from "@/lib/utils"

export default function History() {
  const [rows, setRows] = useState<AnalysisHistoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from("analysis_history")
      .select("id, created_at, verdict, score_mean, score_min, duration_sec, filename, source")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setRows(data as AnalysisHistoryRow[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 md:px-8">
      <Kicker label="Saved history" />
      <h1 className="mt-6 text-4xl leading-tight text-white md:text-6xl">
        Your history<span className="text-violet-400">.</span>
      </h1>
      <p className="mt-4 max-w-xl text-white/55">
        Every analysis you ran while logged in, newest first.
      </p>

      {error && (
        <motion.div
          className="mt-8 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          <p className="text-sm text-rose-200/70">{error}</p>
        </motion.div>
      )}

      {rows === null && !error && (
        <p className="mt-10 text-sm font-medium text-white/40">Loading…</p>
      )}

      {rows && rows.length === 0 && (
        <div className="relative mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-12 text-center">
          <p className="text-sm font-medium text-white/40">
            No saved results yet — run an analysis while logged in.
          </p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="mt-10 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0a16]">
          {rows.map((row) => {
            const isSpoof = row.verdict === "spoof-like"
            return (
              <motion.div
                key={row.id}
                className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-3 md:min-w-0 md:flex-1">
                  {row.source === "live" ? (
                    <Radio className="h-5 w-5 shrink-0 text-white/35" strokeWidth={1.5} />
                  ) : (
                    <FileAudio className="h-5 w-5 shrink-0 text-white/35" strokeWidth={1.5} />
                  )}
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium text-white/85">
                      {row.filename ?? (row.source === "live" ? "Live listen session" : "Upload")}
                    </p>
                    <p className="mt-1 font-mono text-[11px] tabular-nums text-white/35">
                      {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  <SpecCell label="Duration" value={`${row.duration_sec.toFixed(1)}s`} />
                  <SpecCell label="Mean score" value={row.score_mean.toFixed(2)} />
                  <SpecCell label="Min score" value={row.score_min.toFixed(2)} />
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-3 py-1.5 text-center text-xs font-semibold",
                      isSpoof
                        ? "border-rose-400/50 bg-rose-400/[0.06] text-rose-300"
                        : "border-emerald-400/50 bg-emerald-400/[0.06] text-emerald-300"
                    )}
                  >
                    {isSpoof ? "Spoof-like" : "Bonafide-like"}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
