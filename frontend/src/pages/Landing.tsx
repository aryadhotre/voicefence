import { useRef } from "react"
import {
  ArrowRight,
  Ear,
  Landmark,
  MessageCircleWarning,
  Radio,
  Languages,
  ShieldOff,
} from "lucide-react"
import { Link } from "react-router-dom"
import { motion, useScroll, useTransform, type Variants } from "motion/react"
import { HeroVisual } from "@/components/three/HeroVisual"
import { ProductPreview } from "@/components/marketing/ProductPreview"
import { Kicker } from "@/components/ui/dossier"
import { Reveal } from "@/components/anim/Reveal"
import { AnimatedNumber } from "@/components/anim/AnimatedNumber"
import { Magnetic } from "@/components/anim/Magnetic"
import { cn } from "@/lib/utils"

const wedge = [
  {
    icon: MessageCircleWarning,
    title: "WhatsApp voice notes, not RCS calls",
    body:
      "Google's fake-call detection needs both parties on Phone by Google over RCS. Samsung's needs a Galaxy flagship and the native dialer. Neither covers WhatsApp voice notes, unknown numbers, or iPhone callers — where most Indian scam audio actually arrives.",
  },
  {
    icon: Radio,
    title: "Built for codec-compressed audio",
    body:
      "Detectors trained on clean studio corpora degrade badly on real-world fraud audio. Voicefence trains and measures directly against telephony and VoIP compression — AMR, GSM, Opus, μ-law — the actual transmission path of a scam call.",
  },
  {
    icon: Languages,
    title: "Hindi-English code-switching, by design",
    body:
      "Scam scripts in India routinely mix Hindi and English mid-sentence. Voicefence's training set is built from code-switched and monolingual speech in both languages — deliberately, so the model can't shortcut-learn on language mixing alone.",
  },
]

const scamPatterns = [
  {
    icon: Landmark,
    title: "Bank / OTP fraud",
    quote: "“Your account is blocked — share the OTP to verify.”",
    body: "The urgency is the tell. A cloned bank officer's voice removes the last reason to doubt it.",
  },
  {
    icon: ShieldOff,
    title: "Fake emergency",
    quote: "“Beta, mera accident ho gaya hai, paise transfer karo abhi.”",
    body: "Your child's voice, your language, your panic. Generated from seconds of audio scraped off a reel.",
  },
  {
    icon: Ear,
    title: "Cloned family voice",
    quote: "A voice note that sounds exactly like someone you trust — because it was generated to.",
    body: "The scam no longer sounds like a stranger. It sounds like home.",
  },
]

const headlineContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
}

const headlineWord: Variants = {
  hidden: { opacity: 0, y: "0.35em", filter: "blur(6px)" },
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
  const visualY = useTransform(scrollYProgress, [0, 1], [0, 90])
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 50])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.15])

  return (
    <div className="relative">
      {/* Hero */}
      <section
        ref={heroRef}
        className="relative mx-auto flex min-h-[92vh] w-full max-w-7xl flex-col justify-center overflow-visible px-6 pt-24 md:px-8"
      >
        <div className="grid items-center gap-8 lg:grid-cols-[7fr_5fr]">
          <motion.div style={{ y: contentY, opacity: contentOpacity }}>
            <motion.div
              className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[13px] font-medium"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="relative flex h-2 w-2 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-emerald-300">Detector live</span>
              <span className="text-white/35">— trained on real attack data</span>
            </motion.div>

            <motion.h1
              className="text-[clamp(3.4rem,8.5vw,7.5rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white"
              variants={headlineContainer}
              initial="hidden"
              animate="show"
              aria-label="That voice note might not be real."
            >
              <HeadlineWords words={["That", "voice", "note"]} />
              <HeadlineWords words={["might", "not", "be"]} />
              <HeadlineWords
                words={["real."]}
                className="font-serif font-normal italic tracking-normal text-violet-300"
              />
            </motion.h1>

            <motion.p
              className="mt-8 max-w-xl text-base leading-relaxed text-white/55 md:text-lg"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.7 }}
            >
              AI voice cloning is powering a new wave of scam calls in India —
              fake emergencies, bank fraud, kidnapped-relative calls — sent as
              WhatsApp voice notes in Hindi, English, or both. Voicefence
              checks whether a voice was cloned.
            </motion.p>

            <motion.div
              className="mt-10 flex flex-wrap items-center gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.85 }}
            >
              <Magnetic>
                <Link
                  to="/analyze"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-medium text-black transition-colors hover:bg-white/85"
                >
                  Analyze a voice note
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Magnetic>
              <Magnetic>
                <Link
                  to="/live"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-[15px] font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
                >
                  Live-call listening
                </Link>
              </Magnetic>
            </motion.div>
          </motion.div>

          {/* 3D hero object */}
          <motion.div
            className="relative hidden aspect-square w-full lg:block"
            style={{ y: visualY }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
          >
            <HeroVisual className="h-full w-full" />
          </motion.div>
        </div>

        {/* Stat row */}
        <motion.div
          className="mt-16 grid grid-cols-1 gap-8 border-t border-white/[0.06] pt-8 sm:grid-cols-3 lg:mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.1 }}
        >
          {[
            { value: <AnimatedNumber value={0.75} decimals={2} suffix="%" />, label: "EER on held-out Hindi-English deepfake test" },
            { value: <AnimatedNumber value={35} prefix="~" suffix="%" />, label: "Average EER cut under codec compression" },
            { value: <span>HI+EN</span>, label: "Code-switch aware by construction" },
          ].map((s, i) => (
            <div key={i}>
              <span className="font-mono text-3xl tabular-nums text-white md:text-4xl">{s.value}</span>
              <p className="mt-2 text-sm text-white/40">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Product preview — the real UI in a browser frame */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Kicker label="The product" className="justify-center" />
          <h2 className="mt-6 text-4xl leading-tight md:text-5xl">
            A verdict, not a vibe.
          </h2>
          <p className="mt-5 text-white/55">
            Upload a voice note and get a per-window score timeline, the
            model's decision threshold, and an honest probabilistic verdict —
            the same report you see here.
          </p>
        </Reveal>
        <div className="relative mx-auto mt-14 max-w-3xl">
          <div aria-hidden className="glow-radial absolute inset-[-30%] -z-10 opacity-60" />
          <ProductPreview />
        </div>
      </section>

      {/* The problem — sticky stacking cards */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-8">
        <Reveal>
          <Kicker label="The problem" />
          <h2 className="mt-6 max-w-3xl text-4xl leading-tight md:text-6xl">
            The scam call already sounds like family.
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

      {/* The wedge — feature cards */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-8">
        <Reveal>
          <Kicker label="Why this isn't already solved" />
          <h2 className="mt-6 max-w-3xl text-4xl leading-tight md:text-6xl">
            Existing detection misses exactly here.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {wedge.map((w, i) => (
            <Reveal key={w.title} delay={i * 0.1}>
              <div className="flex h-full flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 transition-colors hover:border-white/[0.14]">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10">
                  <w.icon className="h-5 w-5 text-violet-300" strokeWidth={1.5} />
                </span>
                <h3 className="mt-6 text-lg font-semibold tracking-tight text-white">
                  {w.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-white/50">{w.body}</p>
                <Link
                  to="/how-it-works"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
                >
                  Learn more
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="rule">
        <div className="mx-auto max-w-7xl px-6 py-32 text-center md:px-8">
          <Reveal>
            <h2 className="mx-auto max-w-3xl text-5xl leading-[1.05] md:text-7xl">
              Not sure about a voice note you got{" "}
              <em className="font-serif font-normal italic text-violet-300">today?</em>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-white/55">
              Upload it and get a trust score in seconds — or start a live
              check while you're still on the call.
            </p>
          </Reveal>
          <Reveal className="mt-10" delay={0.1}>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Magnetic>
                <Link
                  to="/analyze"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-medium text-black transition-colors hover:bg-white/85"
                >
                  Analyze a voice note
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Magnetic>
              <Magnetic>
                <Link
                  to="/live"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-[15px] font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
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
 * Sticky-stacking scam-pattern cards: each pins below the navbar while the
 * next scrolls up over it, the pinned card scaling back slightly. Under
 * reduced motion the scale transform is inert and the cards simply stack.
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
  const scale = useTransform(progress, [i / total, 1], [1, 1 - (total - i) * 0.045])
  return (
    <div className="sticky top-24 mb-10" style={{ zIndex: i + 1 }}>
      <motion.article
        style={{ scale, transformOrigin: "center top" }}
        className="relative min-h-[22rem] rounded-3xl border border-white/[0.08] bg-[#0d0a16] p-8 md:p-12"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-rose-300/90">
            <data.icon className="h-4 w-4" strokeWidth={1.5} />
            {data.title}
          </span>
          <span className="text-xs tabular-nums text-white/25">
            {i + 1} / {total}
          </span>
        </div>
        <blockquote className="mt-10 max-w-3xl text-3xl font-medium leading-snug tracking-tight text-white md:text-5xl">
          {data.quote}
        </blockquote>
        <p className="mt-10 max-w-md text-sm leading-relaxed text-white/50">{data.body}</p>
      </motion.article>
    </div>
  )
}
