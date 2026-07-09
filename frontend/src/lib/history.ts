import { supabase } from "@/lib/supabase"

export interface AnalysisHistoryRow {
  id: string
  created_at: string
  verdict: "bonafide-like" | "spoof-like"
  score_mean: number
  score_min: number
  duration_sec: number
  filename: string | null
  source: "upload" | "live"
}

export interface SaveHistoryInput {
  verdict: "bonafide-like" | "spoof-like"
  score_mean: number
  score_min: number
  duration_sec: number
  filename?: string | null
  source: "upload" | "live"
}

/**
 * Saves one result row for the current user. No-ops silently when logged
 * out or on failure — saving history must never interrupt the guest or
 * detection flow, so errors are logged, not surfaced.
 */
export async function saveHistory(input: SaveHistoryInput): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) return

  const { error } = await supabase.from("analysis_history").insert({
    user_id: user.id,
    verdict: input.verdict,
    score_mean: input.score_mean,
    score_min: input.score_min,
    duration_sec: input.duration_sec,
    filename: input.filename ?? null,
    source: input.source,
  })

  if (error) {
    console.error("Failed to save analysis history:", error.message)
  }
}
