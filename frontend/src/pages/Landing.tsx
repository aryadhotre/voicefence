import { useRef } from "react"
import { Ear, Landmark, MessageCircleWarning, Radio, Languages, ShieldOff } from "lucide-react"
import { Link } from "react-router-dom"
import { motion, useScroll, useTransform, type Variants } from "motion/react"
import { WebGLShader } from "@/components/ui/web-gl-shader"
import { Kicker, Ticks, SpecCell } from "@/components/ui/dossier"
import { Reveal } from "@/components/anim/Reveal"
import { AnimatedNumber } from "@/components/anim/AnimatedNumber"
import { Magnetic } from "@/components/anim/Magnetic"
import { SpotlightCard } from "@/components/anim/SpotlightCard"
import { Marquee } from "@/components/anim/Marquee"
import { cn } from "@/lib/utils"

const wedge = [
  {
    icon: MessageCircleWarning,
    index: "W/01",
    title: "WhatsApp voice notes, not RCS calls",
    body:
      "Google's fake-call detection needs both parties on Phone by Google over RCS. Samsung Scam Protect needs a Galaxy S26+ and the native dialer, US-first. Neither covers WhatsApp voice notes, unknown numbers, or iPhone callers — where most Indian scam audio actually arrives.",
  },
  {
    icon: Radio,
    index: "W/02",
    title: "Built for codec-compressed audio",
    body:
      "Published 2026 benchmarks show detectors trained on clean studio corpora degrade badly on codec-compressed, real-world fraud audio. Voicefence trains and measures directly against telephony/VoIP compression (AMR, GSM, Opus, μ-law) — the actual transmission path of a scam call.",
  },
  {
    icon: Languages,
    index: "W/03",
    title: "Hindi-English code-switching, by design",
    body:
      "The field's multilingual robustness benchmarks cover zero Indian languages. Scam scripts in India routinely mix Hindi and English mid-sentence. Voicefence's synthetic training set is built from code-switched, monolingual Hindi, and monolingual English speech — deliberately, so the model can't shortcut-learn on language mixing alone.",
  },
]

const scamPatterns = [
  {
    icon: Landmark,
    index: "01",
    title: "Bank / OTP fraud",
    quote: "“Your account is blocked — share the OTP to verify.”",
    body: "The urgency is the tell. A cloned bank officer's voice removes the last reason to doubt it.",
  },
  {
    icon: ShieldOff,
    index: "02",
    title: "Fake emergency",
    quote: "“Beta, mera accident ho gaya hai, paise transfer karo abhi.”",
    body: "Your child's voice, your language, your panic. Generated from seconds of audio scraped off a reel.",
  },
  {
    icon: Ear,
    index: "03",
    title: "Cloned family voice",
    quote: "A voice note that sounds exactly like someone you trust — because it was generated to.",
    body: "The scam no longer sounds like a stranger. It sounds like home.",
  },
]

// Purely illustrative UI texture for the ticker — not real user data.
const tickerEvents: { text: string; verdict: "bonafide" | "spoof" }[] = [
  { text: "voice note analyzed / hindi / bonafide-like", verdict: "bonafide" },
  { text: "live call flagged / spoof-like / amr475 codec", verdict: "spoof" },
  { text: "voice note analyzed / hi-en code-switched / bonafide-like", verdict: "bonafide" },
  { text: "upload scored / opus6k / spoof-like, window 3 of 7", verdict: "spoof" },
  { text: "live call cleared / english / bonafide-like", verdict: "bonafide" },
  { text: "voice note analyzed / gsm codec / bonafide-like", verdict: "bonafide" },
  { text: "upload flagged / μ-law / spoof-like, min below threshold", verdict: "spoof" },
  { text: "live call scored / hindi / bonafide-like / 42s", verdict: "bonafide" },
]

const headlineContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
}

const headlineWord: Variants = {
  hidden: { opacity: 0, y: "0.4em", filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: [0.21, 0.47, 0.32, 0.98] },
  },
}

function HeadlineWords({ words, className }: { words: string[]; className?: string }) {
  return (
    <span className="block">
      {words.map((word, w) => (
        <motion.span
          key={`${word}-${w}`}
          variants={headlineWord}
          className={cn("inline-block whitespace-pre", className)}
          aria-hidden
        >
          {word}
          {w < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  )
}

export default function Landing() {
  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  })
  // Parallax: the shader visual drifts down and swells slightly as the hero
  // scrolls past; the copy retreats a touch slower and fades.
  const shaderY = useTransform(scrollYProgress, [0, 1], [0, 120])
  const shaderScale = useTransform(scrollYProgress, [0, 1], [1, 1.12])
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 60])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.1])

  return (
    <div className="relative">
      {/* Hero */}
      <section
        ref={heroRef}
        className="relative flex min-h-[94vh] w-full flex-col justify-end overflow-hidden"
      >
        <motion.div className="absolute inset-0" style={{ y: shaderY, scale: shaderScale }}>
          <WebGLShader />
          {/* Left-biased vignette: keeps the editorial column readable while
              the shader streak stays visible on the right. */}
          <div
            className="absolute inset-0 z-[5]"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 32% 55%, rgba(8,6,13,0.92) 0%, rgba(8,6,13,0.7) 45%, rgba(8,6,13,0.12) 100%)",
            }}
          />
        </motion.div>

        {/* Ghost watermark */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 top-1/2 z-[6] -translate-y-1/2 select-none font-mono text-[8rem] uppercase leading-none tracking-[0.05em] text-white/[0.04] md:text-[10rem]"
        >
          Voicefence
        </span>

        <motion.div
          className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-16 pt-32 md:px-8"
          style={{ y: contentY, opacity: contentOpacity }}
        >
          <div className="grid gap-12 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <motion.div
                className="mb-8 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }}
              >
                <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-emerald-400">Detector live</span>
                <span className="text-white/30">/ trained &amp; evaluated on real attack data</span>
              </motion.div>

              <motion.h1
                className="font-serif text-[clamp(3.2rem,9vw,7.5rem)] leading-[0.95] tracking-tight text-white"
                variants={headlineContainer}
                initial="hidden"
                animate="show"
                aria-label="That voice note might not be real."
              >
                <HeadlineWords words={["That", "voice", "note"]} />
                <HeadlineWords
                  words={["might", "not", "be"]}
                  className="text-white/90"
                />
                <HeadlineWords words={["real."]} className="italic text-violet-300" />
              </motion.h1>

              <motion.p
                className="mt-8 max-w-xl text-sm leading-relaxed text-white/55 md:text-base"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.85 }}
              >
                AI voice cloning is powering a new wave of scam calls in India —
                fake emergencies, bank fraud, kidnapped-relative calls — sent as
                WhatsApp voice notes in Hindi, English, or both. Voicefence
                checks whether a voice was cloned, built specifically for the
                codec compression and code-switching real scam audio uses.
              </motion.p>

              <motion.div
                className="mt-10 flex flex-wrap items-center gap-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 1 }}
              >
                <Magnetic>
                  <Link
                    to="/analyze"
                    className="inline-block border border-white/25 bg-white/[0.04] px-7 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-white transition-colors hover:border-violet-400/70 hover:bg-violet-400/10"
                  >
                    Analyze a voice note ↗
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link
                    to="/live"
                    className="inline-block px-2 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-white/55 underline-offset-8 transition-colors hover:text-white hover:underline"
                  >
                    Live-call listening →
                  </Link>
                </Magnetic>
              </motion.div>
            </div>

            {/* Spec panel */}
            <motion.aside
              className="relative hidden border border-white/10 bg-black/30 p-6 backdrop-blur-sm lg:col-span-4 lg:block"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.1 }}
            >
              <Ticks />
              <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">
                Detector spec — v2 / codec-aug
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <SpecCell label="Model" value="RawNet2 + FMS" />
                <SpecCell
                  label="EER · clean"
                  value={<AnimatedNumber value={4.91} decimals={2} suffix="%" />}
                />
                <SpecCell label="Codec path" value="AMR·GSM·OPUS·μLAW" />
                <SpecCell
                  label="Avg EER cut"
                  value={<AnimatedNumber value={33} prefix="~" suffix="%" />}
                />
                <SpecCell label="Languages" value="HI · EN · HI-EN" />
                <SpecCell label="Window" value="~4s / any-window flag" />
              </div>
            </motion.aside>
          </div>
        </motion.div>

        {/* Stat band */}
        <motion.div
          className="rule relative z-10 border-b border-white/10 bg-black/25 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.25 }}
        >
          <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-white/10 px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0 md:px-8">
            {[
              { value: <AnimatedNumber value={4.91} decimals={2} suffix="%" />, label: "EER — ASVspoof 2019 LA eval" },
              { value: <AnimatedNumber value={33} prefix="~" suffix="%" />, label: "Avg EER cut under codec compression" },
              { value: <span>HI+EN</span>, label: "Code-switch aware by construction" },
            ].map((s, i) => (
              <div key={i} className="flex items-baseline gap-4 py-5 sm:px-6 first:sm:pl-0">
                <span className="font-mono text-3xl text-white md:text-4xl">{s.value}</span>
                <span className="font-mono text-[10px] uppercase leading-tight tracking-[0.18em] text-white/35">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Detection-event ticker — illustrative texture, not real data */}
      <section className="border-b border-white/5 py-5">
        <Marquee durationSec={45}>
          {tickerEvents.map((e) => (
            <span
              key={e.text}
              className="flex items-center gap-2.5 border border-white/10 bg-white/[0.02] px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white/45"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  e.verdict === "spoof" ? "bg-rose-400" : "bg-emerald-400"
                )}
              />
              {e.text}
            </span>
          ))}
        </Marquee>
        <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.35em] text-white/20">
          Illustrative examples — not real user data
        </p>
      </section>

      {/* The problem — sticky stacking case files */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-8">
        <Reveal>
          <Kicker index="01" label="The problem" />
          <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-tight text-white md:text-6xl">
            The scam call already sounds like{" "}
            <em className="italic text-violet-300">family.</em>
          </h2>
          <p className="mt-5 max-w-2xl text-white/55">
            A few seconds of someone's voice — pulled from a reel, a call, a
            voicemail — is enough to clone it today. What used to be a
            badly-accented stranger on the phone is now a voice note that
            sounds exactly like your father, in his language, on his usual app.
          </p>
        </Reveal>

        <StackedCases />
      </section>

      {/* The wedge — dossier bento */}
      <section className="rule bg-blueprint">
        <div className="mx-auto max-w-7xl px-6 py-24 md:px-8">
          <Reveal>
            <Kicker index="02" label="Why this isn't already solved" />
            <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-tight text-white md:text-6xl">
              Existing detection misses{" "}
              <em className="italic text-emerald-300">exactly here.</em>
            </h2>
            <p className="mt-5 max-w-2xl text-white/55">
              On-device fake-call detection exists — and misses the exact
              conditions Indian scam calls actually happen in.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-px bg-white/10 md:grid-cols-2">
            {wedge.map((w, i) => (
              <Reveal
                key={w.title}
                delay={i * 0.12}
                className={cn("bg-[#08060d]", i === 2 && "md:col-span-2")}
              >
                <SpotlightCard
                  className="h-full rounded-none border-0 bg-white/[0.02]"
                  spotlightColor="rgba(52, 211, 153, 0.08)"
                >
                  <div className={cn("relative p-8", i === 2 && "md:flex md:items-start md:gap-8")}>
                    <Ticks />
                    <div className="mb-5 flex items-center gap-3 md:mb-0 md:shrink-0">
                      <w.icon className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
                      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
                        {w.index}
                      </span>
                    </div>
                    <div className={cn(i !== 2 && "md:mt-5")}>
                      <h3 className="mb-3 text-lg font-semibold tracking-tight text-white">
                        {w.title}
                      </h3>
                      <p className="max-w-2xl text-sm leading-relaxed text-white/50">{w.body}</p>
                    </div>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12" delay={0.15}>
            <Link
              to="/how-it-works"
              className="font-mono text-xs uppercase tracking-[0.2em] text-white/50 underline-offset-8 transition-colors hover:text-white hover:underline"
            >
              Full evaluation — EER by attack, by codec, and the honest limitations →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="rule">
        <div className="mx-auto max-w-7xl px-6 py-28 md:px-8">
          <Reveal>
            <Kicker index="03" label="Run a check" />
            <h2 className="mt-8 font-serif text-5xl leading-[1.02] text-white md:text-7xl">
              Not sure about a voice note
              <br />
              you got <em className="italic text-violet-300">today?</em>
            </h2>
            <p className="mt-6 max-w-xl text-white/55">
              Upload it and get a trust score in seconds — or start a live
              check while you're still on the call.
            </p>
          </Reveal>
          <Reveal className="mt-10" delay={0.1}>
            <div className="flex flex-wrap items-center gap-4">
              <Magnetic>
                <Link
                  to="/analyze"
                  className="inline-block border border-white/25 bg-white/[0.04] px-7 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-white transition-colors hover:border-violet-400/70 hover:bg-violet-400/10"
                >
                  Analyze a voice note ↗
                </Link>
              </Magnetic>
              <Magnetic>
                <Link
                  to="/live"
                  className="inline-block border border-white/10 px-7 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-white/60 transition-colors hover:border-white/30 hover:text-white"
                >
                  Live listen
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}

/**
 * Sticky-stacking case files: each card pins below the navbar while the next
 * scrolls up over it, the pinned card scaling back slightly. Under reduced
 * motion the scale transform is stripped and the cards simply stack.
 */
function StackedCases() {
  const stackRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: stackRef,
    offset: ["start start", "end end"],
  })

  return (
    <div ref={stackRef} className="relative mt-16">
      {scamPatterns.map((s, i) => (
        <StackCard key={s.title} data={s} i={i} total={scamPatterns.length} progress={scrollYProgress} />
      ))}
    </div>
  )
}

function StackCard({
  data,
  i,
  total,
  progress,
}: {
  data: (typeof scamPatterns)[number]
  i: number
  total: number
  progress: ReturnType<typeof useScroll>["scrollYProgress"]
}) {
  // As the stack scrolls, earlier cards settle back: card i starts shrinking
  // once card i+1 begins arriving.
  const scale = useTransform(progress, [i / total, 1], [1, 1 - (total - i) * 0.045])
  return (
    <div className="sticky top-24 mb-10" style={{ zIndex: i + 1 }}>
      <motion.article
        style={{ scale, transformOrigin: "center top" }}
        className="relative min-h-[22rem] border border-white/12 bg-[#0b0912] p-8 md:p-12"
      >
        <Ticks />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
            Case file — {data.index}/03
          </span>
          <data.icon className="h-5 w-5 text-violet-400" strokeWidth={1.5} />
        </div>
        <blockquote className="mt-10 max-w-3xl font-serif text-3xl leading-snug text-white md:text-5xl">
          <em className="italic">{data.quote}</em>
        </blockquote>
        <div className="mt-10 flex flex-col gap-2 md:flex-row md:items-baseline md:gap-8">
          <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-rose-300/90">
            {data.title}
          </h3>
          <p className="max-w-md text-sm text-white/50">{data.body}</p>
        </div>
      </motion.article>
    </div>
  )
}
