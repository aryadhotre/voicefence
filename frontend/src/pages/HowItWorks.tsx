import type { ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { motion, type Variants } from "motion/react"
import { Kicker } from "@/components/ui/dossier"
import { Reveal } from "@/components/anim/Reveal"
import { AnimatedNumber } from "@/components/anim/AnimatedNumber"

// EER percentage that counts up when scrolled into view.
const eer = (v: number) => <AnimatedNumber value={v} decimals={2} suffix="%" duration={1.1} />

const codecRows: { codec: string; baseline: number; codecAug: number; delta: string }[] = [
  { codec: "Clean/uncompressed", baseline: 4.91, codecAug: 5.5, delta: "+0.59pp" },
  { codec: "amr122", baseline: 8.52, codecAug: 5.89, delta: "−2.63pp" },
  { codec: "amr475", baseline: 16.71, codecAug: 7.25, delta: "−9.46pp" },
  { codec: "gsm", baseline: 8.59, codecAug: 6.12, delta: "−2.47pp" },
  { codec: "opus6k", baseline: 12.14, codecAug: 7.18, delta: "−4.96pp" },
  { codec: "opus12k", baseline: 5.21, codecAug: 5.56, delta: "+0.35pp" },
  { codec: "mulaw", baseline: 5.0, codecAug: 5.56, delta: "+0.56pp" },
]

const attackRows = [
  { attack: "A07", baseline: "1.59%", codecAug: "1.63%" },
  { attack: "A08", baseline: "3.56%", codecAug: "1.14%" },
  { attack: "A09", baseline: "0.19%", codecAug: "0.39%" },
  { attack: "A10", baseline: "2.85%", codecAug: "2.38%" },
  { attack: "A11", baseline: "1.52%", codecAug: "1.87%" },
  { attack: "A12", baseline: "2.28%", codecAug: "2.49%" },
  { attack: "A13", baseline: "0.31%", codecAug: "0.29%" },
  { attack: "A14", baseline: "0.55%", codecAug: "0.95%" },
  { attack: "A15", baseline: "2.04%", codecAug: "1.81%" },
  { attack: "A16", baseline: "0.87%", codecAug: "0.77%" },
  { attack: "A17", baseline: "7.82%", codecAug: "10.29%", flag: true },
  { attack: "A18", baseline: "23.65%", codecAug: "18.40%" },
  { attack: "A19", baseline: "1.30%", codecAug: "3.06%", flag: true },
]

const synthRows: { split: string; n: string; eer: number }[] = [
  { split: "Overall", n: "2,000", eer: 33.35 },
  { split: "hi-en (code-switched)", n: "1,000", eer: 33.9 },
  { split: "hi (monolingual)", n: "500", eer: 33.01 },
  { split: "en (monolingual)", n: "500", eer: 32.63 },
]

const limitations = [
  "Detection is probabilistic; scores, not verdicts.",
  "Trained on ASVspoof + synthetic TTS spoofs: strong vs TTS/VC-class synthesis, untested vs a live human impersonator (no synthesis involved).",
  "The synthetic hi-en set measures code-switch robustness; it is not a claim of coverage over all Indian languages/accents.",
  "The synthetic hi-en set has been evaluated against, but not yet trained on — a follow-up retrain folding it into training (with a proper train/test split) is planned, tracked as future work.",
]

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16 md:px-8">
      <Reveal className="mb-16">
        <Kicker label="Evidence" />
        <h1 className="mt-6 text-4xl leading-tight text-white md:text-6xl">
          How it works — the honest numbers<span className="text-violet-400">.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-white/55">
          What the detector was trained and measured on, where it holds up,
          and where it doesn't.
        </p>
      </Reveal>

      {/* Architecture */}
      <section className="mb-20">
        <Reveal>
          <SectionHeading index="04.1" kicker="Architecture" title="The detector" />
          <p className="max-w-3xl leading-relaxed text-white/60">
            A RawNet2-style end-to-end model (Tak et al., 2021): raw waveform →
            a mel-initialized SincConv filter bank → residual blocks with
            filter-wise feature-map scaling → a 3-layer GRU → two logits
            (spoof / bonafide). No hand-crafted spectral features — the model
            learns directly from the raw 16kHz waveform, scored in ~4-second
            windows (a clip is flagged if any single window looks synthetic).
            Baseline: 60 epochs on ASVspoof 2019 LA, {eer(4.91)} EER on the
            eval set (attacks A07-A19, unseen during training).
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-8">
          <ArchitectureDiagram />
        </Reveal>
      </section>

      {/* Codec robustness */}
      <section className="mb-20">
        <Reveal>
          <SectionHeading index="04.2" kicker="Evaluation" title="Codec robustness" />
          <p className="mb-6 max-w-3xl leading-relaxed text-white/60">
            Real scam audio travels over compressed telephony/VoIP codecs, not
            clean studio recordings. A second checkpoint was trained with
            codec-augmented copies of the training set (opus6k, amr475,
            mulaw) and measured against a full 6-codec sweep of the eval set.
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          <Table
            head={["Codec", "Baseline", "Codec-aug", "Δ"]}
            rows={codecRows.map((r) => [r.codec, eer(r.baseline), eer(r.codecAug), r.delta])}
          />
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/45">
            Average across the 6 codecs:{" "}
            <strong className="font-mono text-white/80">{eer(9.36)} → {eer(6.26)}</strong> (~33%
            relative reduction). Worst case (amr475):{" "}
            <strong className="font-mono text-white/80">{eer(16.71)} → {eer(7.25)}</strong> —
            more than halved.
          </p>
        </Reveal>

        <Reveal delay={0.05} className="mt-10">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-white/35">
            Full per-attack EER, clean eval set
          </p>
          <Table
            head={["Attack", "Baseline", "Codec-aug"]}
            rows={attackRows.map((r) => [r.attack, r.baseline, r.codecAug])}
            flagIndexes={attackRows.reduce<number[]>((acc, r, i) => (r.flag ? [...acc, i] : acc), [])}
          />
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/45">
            Codec augmentation costs a small amount on clean audio (4.91% →
            5.50%) and on two voice-conversion attacks (A17, A19 — highlighted
            above), while every other attack is flat or improves, including
            the baseline's single worst attack, A18 (23.65% → 18.40%). A real
            trade-off, not a universal win — described here exactly as
            measured.
          </p>
        </Reveal>
      </section>

      {/* Hindi-English */}
      <section className="mb-20">
        <Reveal>
          <SectionHeading index="04.3" kicker="Language robustness" title="Hindi-English code-switching" />
          <p className="mb-6 max-w-3xl leading-relaxed text-white/60">
            A synthetic 6,000-utterance set — 2,000 <code className="bg-white/10 px-1.5 py-0.5 font-mono text-sm">parler-tts</code>{" "}
            spoofs (Apache-2.0, commercial-safe) split across code-switched,
            monolingual Hindi, and monolingual English text, paired with 4,000
            real bonafide clips (Common Voice Hindi + LibriSpeech English) —
            evaluated against the codec-aug checkpoint:
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          <Table head={["Split", "n (spoof)", "EER"]} rows={synthRows.map((r) => [r.split, r.n, eer(r.eer)])} />
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/45">
            All three language splits land within ~1.3pp of each other — the
            gap isn't concentrated in code-switched or monolingual content, it's
            uniform. The ~33% EER reflects a checkpoint that has never seen a{" "}
            <code className="bg-white/10 px-1 py-0.5 font-mono">parler-tts</code> output during training
            (it trained only on ASVspoof's 2019-era attacks) — this measures
            cross-TTS-engine generalization to an unseen synthesis method, not a
            flaw in the codec-robustness work above.
          </p>
        </Reveal>
      </section>

      {/* Limitations */}
      <section>
        <Reveal>
          <SectionHeading index="04.4" kicker="Disclosure" title="Known limitations" />
        </Reveal>
        <ul className="space-y-3">
          {limitations.map((l, i) => (
            <Reveal key={l} delay={i * 0.08}>
              <li className="flex gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 text-sm leading-relaxed text-white/60">
                <span className="text-xs font-medium leading-6 text-amber-400/80">
                  {i + 1}
                </span>
                {l}
                <AlertTriangle className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-amber-400/60" strokeWidth={1.5} />
              </li>
            </Reveal>
          ))}
        </ul>
      </section>
    </div>
  )
}

function SectionHeading({ index, kicker, title }: { index: string; kicker: string; title: string }) {
  return (
    <div className="mb-6">
      <Kicker index={index} label={kicker} />
      <h2 className="mt-4 text-3xl text-white md:text-4xl">{title}</h2>
    </div>
  )
}

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: "easeOut" },
  }),
}

function Table({
  head,
  rows,
  flagIndexes = [],
}: {
  head: string[]
  rows: ReactNode[][]
  flagIndexes?: number[]
}) {
  return (
    <div className="relative overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {head.map((h) => (
              <th key={h} className="px-5 py-3 text-xs font-medium uppercase tracking-[0.12em] text-white/40">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <motion.tr
              key={i}
              custom={i}
              variants={rowVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              className={
                "border-b border-white/5 last:border-0" +
                (flagIndexes.includes(i) ? " bg-amber-500/[0.06]" : "")
              }
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={
                    "px-5 py-3 font-mono tabular-nums" +
                    (j === 0 ? " text-white/80" : " text-white/55")
                  }
                >
                  {cell}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- Animated architecture diagram ------------------------------------------
// waveform → SincConv → ResBlocks → GRU → output, with connector lines that
// draw themselves in (pathLength ≙ stroke-dashoffset) as it scrolls into view.

const STAGE_W = 120
const STAGE_H = 52
const STAGE_GAP = 30
const STAGES = [
  { label: "Raw waveform", sub: "16kHz" },
  { label: "SincConv", sub: "mel-init filters" },
  { label: "ResBlocks", sub: "×6, FMS" },
  { label: "GRU", sub: "×3 layers" },
  { label: "Output", sub: "spoof / bonafide" },
]

const boxVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.24, duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] },
  }),
}

const lineVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: { delay: i * 0.24 + 0.2, duration: 0.35, ease: "easeInOut" },
  }),
}

function ArchitectureDiagram() {
  const totalW = STAGES.length * STAGE_W + (STAGES.length - 1) * STAGE_GAP
  const midY = STAGE_H / 2 + 8

  return (
    <div className="relative overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.015] p-5">
      <motion.svg
        viewBox={`0 0 ${totalW} ${STAGE_H + 16}`}
        className="mx-auto block h-auto w-full min-w-[560px] max-w-3xl"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        aria-label="Detector architecture: raw waveform into SincConv into residual blocks into GRU into output logits"
      >
        {STAGES.map((stage, i) => {
          const x = i * (STAGE_W + STAGE_GAP)
          return (
            <g key={stage.label}>
              <motion.g variants={boxVariants} custom={i} style={{ transformOrigin: `${x + STAGE_W / 2}px ${midY}px` }}>
                <rect
                  x={x}
                  y={8}
                  width={STAGE_W}
                  height={STAGE_H}
                  rx={0}
                  fill="rgba(139,92,246,0.06)"
                  stroke={i === STAGES.length - 1 ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.18)"}
                  strokeWidth={1}
                />
                <text
                  x={x + STAGE_W / 2}
                  y={midY - 3}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.9)"
                  fontSize={11}
                  fontFamily="'Geist Mono Variable', monospace"
                  fontWeight={500}
                >
                  {stage.label}
                </text>
                <text
                  x={x + STAGE_W / 2}
                  y={midY + 11}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.4)"
                  fontSize={8.5}
                  fontFamily="'Geist Mono Variable', monospace"
                >
                  {stage.sub}
                </text>
              </motion.g>
              {i < STAGES.length - 1 && (
                <>
                  <motion.path
                    variants={lineVariants}
                    custom={i}
                    d={`M ${x + STAGE_W + 4} ${midY} L ${x + STAGE_W + STAGE_GAP - 8} ${midY}`}
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    fill="none"
                  />
                  <motion.path
                    variants={lineVariants}
                    custom={i}
                    d={`M ${x + STAGE_W + STAGE_GAP - 13} ${midY - 4} L ${x + STAGE_W + STAGE_GAP - 8} ${midY} L ${x + STAGE_W + STAGE_GAP - 13} ${midY + 4}`}
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    fill="none"
                  />
                </>
              )}
            </g>
          )
        })}
      </motion.svg>
    </div>
  )
}
