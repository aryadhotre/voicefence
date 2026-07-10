import { Link, useLocation, useOutlet } from "react-router-dom"
import { AnimatePresence, motion } from "motion/react"
import { Navbar } from "./Navbar"
import { CursorGlow } from "@/components/anim/CursorGlow"
import { SmoothScroll, scrollToTop } from "@/components/anim/SmoothScroll"

export function Layout() {
  const location = useLocation()
  // useOutlet (not <Outlet/>) so AnimatePresence can hold the previous
  // route's element while it animates out.
  const outlet = useOutlet()

  return (
    <div className="min-h-screen bg-[#08060d] text-white">
      <SmoothScroll />
      <CursorGlow />
      <div className="grain-overlay" aria-hidden />
      <Navbar />
      <AnimatePresence mode="wait" onExitComplete={scrollToTop}>
        <motion.main
          key={location.pathname}
          className="pt-14"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {outlet}
        </motion.main>
      </AnimatePresence>

      <footer className="rule mt-4">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-8">
          <div className="flex flex-col gap-12 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Voicefence<span className="text-violet-400">.</span>
              </p>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-white/45">
                Detection is probabilistic — a risk signal, never a guarantee.
                Verify independently: call back on a known number, ask an
                unscripted question.
              </p>
            </div>
            <div className="flex gap-16 text-sm">
              <div className="flex flex-col gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-white/30">Detect</span>
                <Link to="/analyze" className="font-medium text-white/60 transition-colors hover:text-white">Analyze</Link>
                <Link to="/live" className="font-medium text-white/60 transition-colors hover:text-white">Live listen</Link>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-white/30">Evidence</span>
                <Link to="/how-it-works" className="font-medium text-white/60 transition-colors hover:text-white">The numbers</Link>
                <Link to="/how-it-works" className="font-medium text-white/60 transition-colors hover:text-white">Limitations</Link>
              </div>
            </div>
          </div>
          <div className="rule mt-12 flex flex-col gap-2 pt-5 text-xs text-white/25 sm:flex-row sm:justify-between">
            <span>Built for the call you almost trusted</span>
            <span className="font-mono text-[11px]">RawNet2 · ASVspoof 2019 LA · HI/EN</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
