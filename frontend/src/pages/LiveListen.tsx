import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  Mic,
  PhoneOff,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"
import { motion, useSpring, useTransform, useReducedMotion } from "motion/react"
import { liveAnalyzeUrl, type StreamMessage, type StreamScoreMessage } from "@/lib/api"
import { Kicker, Ticks, SpecCell } from "@/components/ui/dossier"
import { RadialGauge } from "@/components/anim/RadialGauge"
import { cn } from "@/lib/utils"

type CallState = "idle" | "connecting" | "live" | "ended" | "error"

const CHUNK_SECONDS = 1
const TARGET_SR = 16_000
// Display range for the trust gauge — observed raw scores in testing run
// roughly -10..+10; this just fixes the gauge's visual scale, it has no
// effect on the actual verdict (that's smoothed_score vs threshold, from
// the server).
const GAUGE_MIN = -10
const GAUGE_MAX = 10

const normalizeScore = (s: number) =>
  Math.min(1, Math.max(0, (s - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)))

function resampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === TARGET_SR) return input
  const ratio = inputSampleRate / TARGET_SR
  const outLength = Math.floor(input.length / ratio)
  const output = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio
    const idx0 = Math.floor(srcIndex)
    const idx1 = Math.min(idx0 + 1, input.length - 1)
    const frac = srcIndex - idx0
    output[i] = input[idx0] * (1 - frac) + input[idx1] * frac
  }
  return output
}

function floatTo16BitPCM(buf: Float32Array): Int16Array {
  const out = new Int16Array(buf.length)
  for (let i = 0; i < buf.length; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

export default function LiveListen() {
  const [callState, setCallState] = useState<CallState>("idle")
  const [latest, setLatest] = useState<StreamScoreMessage | null>(null)
  const [history, setHistory] = useState<StreamScoreMessage[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [endedReason, setEndedReason] = useState<string | null>(null)
  // Held in state (not just a ref) so the waveform component re-renders and
  // starts drawing the moment the node exists.
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const pcmBufferRef = useRef<Float32Array>(new Float32Array(0))

  const cleanupAudio = useCallback(() => {
    try {
      processorRef.current?.disconnect()
      sourceRef.current?.disconnect()
    } catch {
      // already disconnected — fine
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {})
    }
    processorRef.current = null
    sourceRef.current = null
    streamRef.current = null
    audioCtxRef.current = null
    pcmBufferRef.current = new Float32Array(0)
    setAnalyser(null)
  }, [])

  const stop = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    cleanupAudio()
    setCallState((s) => (s === "error" ? s : "ended"))
  }, [cleanupAudio])

  const start = useCallback(async () => {
    setErrorMsg(null)
    setEndedReason(null)
    setHistory([])
    setLatest(null)
    setCallState("connecting")

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setErrorMsg("Microphone access was denied or unavailable.")
      setCallState("error")
      return
    }
    streamRef.current = stream

    const ws = new WebSocket(liveAnalyzeUrl())
    wsRef.current = ws

    ws.onopen = () => {
      setCallState("live")

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      sourceRef.current = source

      // Tap the mic with an AnalyserNode for the live waveform visual — a
      // read-only branch of the graph, separate from the chunking path that
      // feeds the WebSocket.
      const analyserNode = audioCtx.createAnalyser()
      analyserNode.fftSize = 256
      analyserNode.smoothingTimeConstant = 0.75
      source.connect(analyserNode)
      setAnalyser(analyserNode)

      // ScriptProcessorNode is deprecated in favor of AudioWorklet, but
      // needs no separate module file to load and is supported everywhere
      // — a reasonable choice for this build; migrating to AudioWorklet
      // (runs off the main thread) would be the production follow-up.
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0)
        const resampled = resampleTo16k(input, audioCtx.sampleRate)
        const prev = pcmBufferRef.current
        const combined = new Float32Array(prev.length + resampled.length)
        combined.set(prev)
        combined.set(resampled, prev.length)

        const chunkSize = TARGET_SR * CHUNK_SECONDS
        let offset = 0
        while (combined.length - offset >= chunkSize) {
          const slice = combined.slice(offset, offset + chunkSize)
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(floatTo16BitPCM(slice).buffer as ArrayBuffer)
          }
          offset += chunkSize
        }
        pcmBufferRef.current = combined.slice(offset)
      }

      // Route through a muted gain node rather than straight to destination
      // — some browsers only fire onaudioprocess once the node is part of
      // a live graph reaching the destination, but we don't want the user
      // to hear their own mic echoed back.
      const mute = audioCtx.createGain()
      mute.gain.value = 0
      source.connect(processor)
      processor.connect(mute)
      mute.connect(audioCtx.destination)
    }

    ws.onmessage = (event) => {
      const msg: StreamMessage = JSON.parse(event.data)
      if (msg.type === "score") {
        setLatest(msg)
        setHistory((h) => [...h, msg])
      } else if (msg.type === "error") {
        setErrorMsg(msg.detail)
      } else if (msg.type === "call_ended") {
        setEndedReason(msg.reason)
        stop()
      }
    }

    ws.onerror = () => {
      setErrorMsg("Connection to the analysis server was lost. Is the backend running?")
      setCallState("error")
      cleanupAudio()
    }

    ws.onclose = () => {
      cleanupAudio()
      setCallState((s) => (s === "error" || s === "ended" ? s : "ended"))
    }
  }, [cleanupAudio, stop])

  // Stop everything if the user navigates away mid-call.
  useEffect(() => {
    return () => {
      wsRef.current?.close()
      cleanupAudio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isSpoof = latest?.verdict === "spoof-like"

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:px-8">
      <div className="mb-12">
        <Kicker index="03" label="Live monitor" />
        <h1 className="mt-6 font-serif text-4xl leading-tight text-white md:text-6xl">
          Live <em className="italic text-violet-300">Listen.</em>
        </h1>
        <p className="mt-4 max-w-xl text-white/55">
          Start this while you're on a call (put it on speaker near your
          phone, or use it for a call already routed through this device).
          Voicefence needs ~4 seconds of audio before the first score, then
          updates roughly once a second.
        </p>
      </div>

      {callState === "idle" && (
        <div className="relative flex flex-col items-center gap-6 border border-white/12 bg-white/[0.02] p-12 text-center">
          <Ticks />
          <MicRings active={false}>
            <Mic className="h-10 w-10 text-white/60" strokeWidth={1.5} />
          </MicRings>
          <button
            type="button"
            onClick={() => void start()}
            className="border border-white/25 bg-white/[0.04] px-8 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-white transition-colors hover:border-violet-400/70 hover:bg-violet-400/10"
          >
            Start live listen ●
          </button>
          <p className="max-w-sm font-mono text-[10px] uppercase leading-relaxed tracking-[0.15em] text-white/30">
            Demo endpoint — no auth yet. Local testing on a trusted network only.
          </p>
        </div>
      )}

      {callState === "connecting" && (
        <div className="relative flex flex-col items-center gap-4 border border-white/12 bg-white/[0.02] p-12 text-center">
          <Ticks />
          <MicRings active={false}>
            <Mic className="h-10 w-10 animate-pulse text-violet-400 motion-reduce:animate-none" strokeWidth={1.5} />
          </MicRings>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/60">
            Requesting microphone access…
          </p>
        </div>
      )}

      {(callState === "live" || callState === "ended") && (
        <div className="space-y-6">
          <div className="relative border border-white/12 bg-[#0b0912]">
            <Ticks />
            {/* Console header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
              <span className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                {callState === "live" ? (
                  <>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500 motion-reduce:animate-none" />
                    <span className="text-rose-300">Rec</span>
                  </>
                ) : (
                  <span className="text-white/30">Session ended</span>
                )}
                <span className="text-white/25">/ live trust meter</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-white/60">
                {latest ? `${latest.duration_sec.toFixed(0)}s` : "0s"}
              </span>
            </div>

            <div className="flex flex-col items-center gap-8 p-8 sm:flex-row sm:justify-center sm:gap-12">
              <TrustGauge latest={latest} />
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  {latest ? (
                    isSpoof ? (
                      <ShieldAlert className="h-7 w-7 shrink-0 text-rose-400" strokeWidth={1.5} />
                    ) : (
                      <ShieldCheck className="h-7 w-7 shrink-0 text-emerald-400" strokeWidth={1.5} />
                    )
                  ) : (
                    <MicRings active={callState === "live"} size="sm">
                      <Mic className="h-5 w-5 text-white/60" strokeWidth={1.5} />
                    </MicRings>
                  )}
                  <p
                    className={cn(
                      "font-mono text-sm uppercase tracking-[0.15em]",
                      latest ? (isSpoof ? "text-rose-300" : "text-emerald-300") : "text-white/45"
                    )}
                  >
                    {latest ? (isSpoof ? "Spoof-like" : "Bonafide-like") : "Listening… first score in ~4s"}
                  </p>
                </div>
                {latest && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <SpecCell label="Window" value={`#${latest.window_index}`} />
                    <SpecCell label="Raw" value={latest.raw_score.toFixed(2)} />
                    <SpecCell label="Smoothed" value={latest.smoothed_score.toFixed(2)} />
                    <SpecCell label="Threshold" value={latest.threshold.toFixed(2)} />
                  </div>
                )}
              </div>
            </div>

            {callState === "live" && (
              <div className="border-t border-white/10 px-6 py-4">
                <LiveWaveform analyser={analyser} />
                <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.35em] text-white/25">
                  Live mic input
                </p>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">
                Score history this call
              </p>
              <div className="flex h-24 items-end gap-0.5 overflow-hidden border border-white/10 bg-white/[0.02] p-2">
                {history.slice(-72).map((h) => (
                  <motion.div
                    key={h.window_index}
                    title={`#${h.window_index}: raw ${h.raw_score.toFixed(2)}, smoothed ${h.smoothed_score.toFixed(2)}`}
                    className={cn(
                      "min-w-0 flex-1",
                      h.verdict === "spoof-like" ? "bg-rose-400/70" : "bg-emerald-400/70"
                    )}
                    style={{
                      height: `${Math.max(normalizeScore(h.smoothed_score) * 100, 4)}%`,
                      originY: 1,
                    }}
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  />
                ))}
              </div>
            </div>
          )}

          {callState === "ended" && (
            <motion.div
              className="border border-white/10 bg-white/[0.02] p-4 text-center font-mono text-xs uppercase tracking-[0.15em] text-white/50"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Call ended{endedReason ? ` — ${endedReason}` : "."}
            </motion.div>
          )}

          <div className="flex justify-center">
            {callState === "live" ? (
              <button
                type="button"
                onClick={stop}
                className="flex items-center gap-2 border border-rose-400/60 bg-rose-500/10 px-7 py-3 font-mono text-xs uppercase tracking-[0.2em] text-rose-200 transition-colors hover:bg-rose-500/20"
              >
                <PhoneOff className="h-4 w-4" /> Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void start()}
                className="border border-white/25 bg-white/[0.04] px-7 py-3 font-mono text-xs uppercase tracking-[0.2em] text-white transition-colors hover:border-violet-400/70 hover:bg-violet-400/10"
              >
                Start again ●
              </button>
            )}
          </div>
        </div>
      )}

      {callState === "error" && (
        <div className="flex flex-col items-center gap-4 border border-rose-500/30 bg-rose-500/10 p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-400" />
          <p className="text-sm text-rose-200">{errorMsg}</p>
          <button
            type="button"
            onClick={() => void start()}
            className="border border-white/20 px-7 py-3 font-mono text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-white/10"
          >
            Try again
          </button>
        </div>
      )}

      {errorMsg && callState === "live" && (
        <div className="mt-4 flex items-center gap-2 border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {errorMsg}
        </div>
      )}
    </div>
  )
}

/**
 * Radial trust gauge: springs to each new smoothed (EMA) score as WebSocket
 * messages arrive, with the stroke color interpolating continuously from
 * rose (spoof-like) through amber to teal (bonafide) — no hard color snap.
 */
function TrustGauge({ latest }: { latest: StreamScoreMessage | null }) {
  const reduced = useReducedMotion()
  const progress = useSpring(0.5, { stiffness: 85, damping: 18, mass: 1 })
  const color = useTransform(progress, [0, 0.5, 1], ["#fb7185", "#f59e0b", "#2dd4bf"])

  useEffect(() => {
    if (!latest) return
    const target = normalizeScore(latest.smoothed_score)
    if (reduced) progress.jump(target)
    else progress.set(target)
  }, [latest, progress, reduced])

  return (
    <RadialGauge
      progress={progress}
      stroke={color}
      marker={latest ? normalizeScore(latest.threshold) : 0.5}
      className="h-40 w-40 shrink-0"
    >
      <span className="text-2xl font-bold text-white">
        {latest ? latest.smoothed_score.toFixed(2) : "—"}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-widest text-white/40">
        smoothed
      </span>
    </RadialGauge>
  )
}

/**
 * Pulsing concentric rings around the mic — a slow ambient pulse while idle,
 * faster and stronger while actually recording. Skipped entirely under
 * prefers-reduced-motion.
 */
function MicRings({
  active,
  size = "md",
  children,
}: {
  active: boolean
  size?: "sm" | "md"
  children: React.ReactNode
}) {
  const reduced = useReducedMotion()
  const duration = active ? 1.5 : 2.6
  const rings = [0, 1, 2]

  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        size === "md" ? "h-20 w-20" : "h-10 w-10"
      )}
    >
      {!reduced &&
        rings.map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full border",
              active ? "border-violet-400/50" : "border-white/25"
            )}
            animate={{ scale: [1, active ? 2 : 1.6], opacity: [active ? 0.6 : 0.4, 0] }}
            transition={{
              duration,
              repeat: Infinity,
              delay: (i * duration) / rings.length,
              ease: "easeOut",
            }}
          />
        ))}
      <span
        className={cn(
          "relative flex items-center justify-center rounded-full border",
          active ? "border-violet-400/60 bg-violet-500/15" : "border-white/15 bg-white/[0.04]",
          size === "md" ? "h-20 w-20" : "h-10 w-10"
        )}
      >
        {children}
      </span>
    </div>
  )
}

/**
 * Genuinely audio-reactive waveform: bars driven by the live AnalyserNode
 * frequency data from the user's mic, rendered to canvas at display
 * resolution. Under prefers-reduced-motion the redraw drops to ~10fps —
 * still functional level feedback, minus the constant motion.
 */
function LiveWaveform({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!analyser || !canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const data = new Uint8Array(analyser.frequencyBinCount)
    const dpr = window.devicePixelRatio || 1
    const minFrameMs = reduced ? 100 : 0
    let raf = 0
    let last = 0

    const resize = () => {
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr))
    }
    resize()
    window.addEventListener("resize", resize)

    const BAR_COUNT = 48
    const step = Math.max(1, Math.floor(data.length / BAR_COUNT))

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      if (t - last < minFrameMs) return
      last = t

      analyser.getByteFrequencyData(data)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const bw = canvas.width / BAR_COUNT

      for (let i = 0; i < BAR_COUNT; i++) {
        const v = data[i * step] / 255
        const h = Math.max(v * canvas.height * 0.92, 2.5 * dpr)
        const x = i * bw + bw * 0.2
        const w = bw * 0.6
        const y = (canvas.height - h) / 2
        ctx.fillStyle = `rgba(167, 139, 250, ${0.3 + v * 0.7})`
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, w / 2)
        ctx.fill()
      }
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [analyser, reduced])

  return <canvas ref={canvasRef} className="h-20 w-full" aria-hidden />
}
