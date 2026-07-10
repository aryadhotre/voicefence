import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, UploadCloud } from "lucide-react"
import { motion, useSpring, useReducedMotion, type Variants } from "motion/react"
import { analyzeFile, ApiError, type AnalyzeResponse } from "@/lib/api"
import { saveHistory } from "@/lib/history"
import { consumePendingSharedAudio, MAX_SHARE_UPLOAD_MB } from "@/lib/shareTarget"
import { Kicker, SpecCell } from "@/components/ui/dossier"
import { RadialGauge } from "@/components/anim/RadialGauge"
import { AnimatedNumber } from "@/components/anim/AnimatedNumber"
import { WaveformLoader } from "@/components/anim/WaveformLoader"
import { cn } from "@/lib/utils"

type Status = "idle" | "loading" | "done" | "error"

// Display range for the score gauge — raw scores observed in testing run
// roughly -10..+10 (same convention as Live Listen). Visual scale only; the
// verdict always comes from the server.
const GAUGE_MIN = -10
const GAUGE_MAX = 10

const normalizeScore = (s: number) =>
  Math.min(1, Math.max(0, (s - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)))

const dropzoneVariants: Variants = {
  idle: {
    scale: 1,
    boxShadow: "0 0 0px 0px rgba(167,139,250,0)",
  },
  drag: {
    scale: 1.015,
    boxShadow: [
      "0 0 0px 0px rgba(167,139,250,0)",
      "0 0 36px 6px rgba(167,139,250,0.22)",
      "0 0 0px 0px rgba(167,139,250,0)",
    ],
    transition: {
      scale: { type: "spring", stiffness: 300, damping: 20 },
      boxShadow: { duration: 1.3, repeat: Infinity, ease: "easeInOut" },
    },
  },
  drop: {
    scale: [1, 0.965, 1.008, 1],
    transition: { duration: 0.45, ease: "easeOut" },
  },
}

const resultsContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.16, delayChildren: 0.05 } },
}

const resultItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] },
  },
}

// The verdict stamp arrives with a different feel per verdict: a confident
// settle for bonafide, a sharper snap with a small lateral shake for
// spoof-like.
const bonafideBadge: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      opacity: { duration: 0.25 },
      scale: { type: "spring", stiffness: 170, damping: 20 },
    },
  },
}

const spoofBadge: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  show: {
    opacity: 1,
    scale: 1,
    x: [0, -5, 4, -2, 0],
    transition: {
      opacity: { duration: 0.18 },
      scale: { type: "spring", stiffness: 480, damping: 14 },
      x: { duration: 0.45, delay: 0.12, ease: "easeOut" },
    },
  },
}

export default function Analyze() {
  const [status, setStatus] = useState<Status>("idle")
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dropPulse, setDropPulse] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const runAnalysis = useCallback(async (file: File) => {
    setStatus("loading")
    setError(null)
    setResult(null)
    setFileName(file.name)
    try {
      const res = await analyzeFile(file, file.name)
      setResult(res)
      setStatus("done")
      void saveHistory({
        verdict: res.verdict,
        score_mean: res.score_mean,
        score_min: res.score_min,
        duration_sec: res.duration_sec,
        filename: file.name,
        source: "upload",
      })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reach the analysis server. Is the backend running?")
      setStatus("error")
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) {
        setDropPulse(true)
        void runAnalysis(file)
      }
    },
    [runAnalysis]
  )

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void runAnalysis(file)
    },
    [runAnalysis]
  )

  // Picks up a file shared in from another app (e.g. WhatsApp's share
  // sheet) via the Web Share Target flow — see public/sw-share-target.js,
  // which redirects here with ?shared=1 after stashing the file.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("shared") !== "1") return
    window.history.replaceState({}, "", window.location.pathname)

    void (async () => {
      const shared = await consumePendingSharedAudio()
      if (!shared) return
      if (!shared.ok) {
        setStatus("error")
        setError(
          shared.error === "invalid-type"
            ? "The shared file isn't an audio file."
            : `The shared file is larger than the ${MAX_SHARE_UPLOAD_MB}MB limit.`
        )
        return
      }
      void runAnalysis(shared.file)
    })()
  }, [runAnalysis])

  const isSpoof = result?.verdict === "spoof-like"

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 md:px-8">
      <div className="mb-12">
        <Kicker label="Upload analysis" />
        <h1 className="mt-6 text-4xl leading-tight text-white md:text-6xl">
          Analyze a voice note<span className="text-violet-400">.</span>
        </h1>
        <p className="mt-4 max-w-xl text-white/55">
          Drop a WhatsApp voice note, phone recording, or any audio file.
          Any format ffmpeg or libsndfile can decode works — .ogg/.opus,
          .mp3, .m4a, .wav, .flac.
        </p>
      </div>

      <motion.div
        variants={dropzoneVariants}
        animate={dragging ? "drag" : dropPulse ? "drop" : "idle"}
        onAnimationComplete={(def) => {
          if (def === "drop") setDropPulse(false)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-white/[0.02] px-6 py-16 text-center transition-colors",
          dragging ? "border-violet-400/70 bg-violet-400/10" : "border-white/15 hover:border-white/30 hover:bg-white/[0.04]",
          status === "loading" && "pointer-events-none"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.ogg,.opus,.m4a,.amr"
          className="hidden"
          onChange={onPick}
        />
        {status === "loading" ? (
          <motion.div
            className="flex flex-col items-center gap-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <WaveformLoader />
            <p className="text-sm font-medium text-white/60">
              Analyzing “{fileName}”…
            </p>
          </motion.div>
        ) : (
          <>
            <UploadCloud className="h-7 w-7 text-white/35" strokeWidth={1.5} />
            <p className="text-[15px] font-medium text-white">
              Drop a file here — or click to browse
            </p>
            <p className="text-xs text-white/35">Max 25MB by default</p>
          </>
        )}
      </motion.div>

      {status === "error" && (
        <motion.div
          className="mt-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          <div>
            <p className="text-sm font-semibold text-rose-200">Analysis failed</p>
            <p className="mt-1 text-sm text-rose-200/70">{error}</p>
          </div>
        </motion.div>
      )}

      {status === "done" && result && (
        <motion.div
          className="relative mt-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0a16]"
          variants={resultsContainer}
          initial="hidden"
          animate="show"
        >
          {/* Report header */}
          <motion.div variants={resultItem} className="border-b border-white/[0.06] p-6 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-white/35">
                Analysis report
              </span>
              <span className="font-mono text-[11px] text-white/25">
                RawNet2 · codec-aug checkpoint
              </span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
              <SpecCell label="File" value={<span className="break-all">{fileName}</span>} />
              <SpecCell label="Duration" value={`${result.duration_sec.toFixed(1)}s`} />
              <SpecCell label="Windows" value={result.window_scores.length} />
              <SpecCell label="Threshold" value={result.threshold.toFixed(2)} />
            </div>
          </motion.div>

          {/* Verdict + gauge */}
          <div className="grid gap-0 border-b border-white/[0.06] md:grid-cols-2">
            <motion.div
              variants={isSpoof ? spoofBadge : bonafideBadge}
              className="flex items-center justify-center border-b border-white/[0.06] p-8 md:border-b-0 md:border-r"
            >
              <div
                className={cn(
                  "rounded-xl border px-7 py-5 text-center",
                  isSpoof
                    ? "border-rose-400/60 bg-rose-400/[0.06] text-rose-300"
                    : "border-emerald-400/60 bg-emerald-400/[0.06] text-emerald-300"
                )}
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">
                  Verdict
                </p>
                <p className="mt-1 whitespace-nowrap text-2xl font-semibold tracking-tight md:text-3xl">
                  {isSpoof ? "Spoof-like" : "Bonafide-like"}
                </p>
              </div>
            </motion.div>

            <motion.div variants={resultItem} className="flex flex-col items-center gap-6 p-8 sm:flex-row sm:justify-center">
              <ScoreGauge score={result.score_mean} threshold={result.threshold} isSpoof={isSpoof} />
              <div className="grid grid-cols-1 gap-4">
                <SpecCell label="Min score" value={result.score_min.toFixed(2)} />
                <SpecCell label="Mean score" value={result.score_mean.toFixed(2)} />
                <SpecCell label="Threshold" value={result.threshold.toFixed(2)} />
              </div>
            </motion.div>
          </div>

          {/* Window timeline */}
          <motion.div variants={resultItem} className="border-b border-white/[0.06] p-6 md:p-8">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-white/35">
              Per-window score timeline
            </p>
            <WindowChart scores={result.window_scores} threshold={result.threshold} />
            <p className="mt-3 max-w-2xl text-xs leading-relaxed text-white/40">
              Each bar is one ~4-second analysis window. Bars below the dashed
              threshold line pushed the clip toward "spoof-like" — a clip is
              flagged if any single window looks synthetic.
            </p>
          </motion.div>

          <motion.p
            variants={resultItem}
            className="p-6 text-xs leading-relaxed text-white/40 md:px-8"
          >
            {result.disclaimer}
          </motion.p>
        </motion.div>
      )}
    </div>
  )
}

/** Radial gauge that springs from 0 to the returned mean score. */
function ScoreGauge({ score, threshold, isSpoof }: { score: number; threshold: number; isSpoof: boolean }) {
  const reduced = useReducedMotion()
  const progress = useSpring(0, { stiffness: 55, damping: 15, mass: 1 })

  useEffect(() => {
    const target = normalizeScore(score)
    if (reduced) {
      progress.jump(target)
    } else {
      progress.jump(0)
      progress.set(target)
    }
  }, [score, progress, reduced])

  return (
    <RadialGauge
      progress={progress}
      stroke={isSpoof ? "#fb7185" : "#34d399"}
      marker={normalizeScore(threshold)}
      className="h-44 w-44 shrink-0"
    >
      <AnimatedNumber
        value={score}
        decimals={2}
        duration={1.1}
        className={cn("font-mono text-3xl font-bold", isSpoof ? "text-rose-200" : "text-emerald-200")}
      />
      <span className="mt-1 text-[9px] uppercase tracking-[0.2em] text-white/35">
        mean score
      </span>
    </RadialGauge>
  )
}

function WindowChart({ scores, threshold }: { scores: number[]; threshold: number }) {
  const all = [...scores, threshold]
  const max = Math.max(...all, 1)
  const min = Math.min(...all, -1)
  const range = max - min || 1
  const zeroPct = ((max - threshold) / range) * 100

  return (
    <div className="relative h-40 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div
        className="absolute left-3 right-3 border-t border-dashed border-white/30"
        style={{ top: `${zeroPct}%` }}
      />
      <div className="flex h-full items-end gap-1">
        {scores.map((s, i) => {
          const heightPct = ((s - min) / range) * 100
          const isSpoof = s < threshold
          return (
            <motion.div
              key={i}
              title={`window ${i + 1}: ${s.toFixed(2)}`}
              className={cn("flex-1", isSpoof ? "bg-rose-400/70" : "bg-emerald-400/70")}
              style={{ height: `${Math.max(heightPct, 2)}%`, originY: 1 }}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{
                delay: 0.15 + i * 0.045,
                type: "spring",
                stiffness: 260,
                damping: 22,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
