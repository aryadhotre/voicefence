// Types and helpers for talking to the backend (see backend/app/schemas.py —
// kept in sync by hand since the two projects don't currently share a
// generated client).

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8000"

export interface AnalyzeResponse {
  verdict: "bonafide-like" | "spoof-like"
  score_min: number
  score_mean: number
  threshold: number
  duration_sec: number
  window_scores: number[]
  disclaimer: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** POST an audio file (any format ffmpeg/soundfile can decode) to /analyze. */
export async function analyzeFile(file: File | Blob, filename = "upload"): Promise<AnalyzeResponse> {
  const form = new FormData()
  form.append("file", file, filename)

  const res = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    body: form,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.detail ?? `Request failed (${res.status})`)
  }

  return res.json() as Promise<AnalyzeResponse>
}

// --- /ws/live-analyze ------------------------------------------------------

export interface StreamScoreMessage {
  type: "score"
  window_index: number
  raw_score: number
  smoothed_score: number
  threshold: number
  verdict: "bonafide-like" | "spoof-like"
  duration_sec: number
}

export interface StreamErrorMessage {
  type: "error"
  detail: string
}

export interface StreamEndMessage {
  type: "call_ended"
  reason: string
  duration_sec: number
}

export type StreamMessage = StreamScoreMessage | StreamErrorMessage | StreamEndMessage

/** WebSocket URL for the live-analyze endpoint, derived from API_URL. */
export function liveAnalyzeUrl(): string {
  const wsBase = API_URL.replace(/^http/, "ws")
  return `${wsBase}/ws/live-analyze`
}
