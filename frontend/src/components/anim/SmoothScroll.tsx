import { useEffect } from "react"
import { useReducedMotion } from "motion/react"
import Lenis from "lenis"
import "lenis/dist/lenis.css"

let activeLenis: Lenis | null = null

/** Jump straight to the top — used between route transitions. */
export function scrollToTop() {
  if (activeLenis) activeLenis.scrollTo(0, { immediate: true })
  else window.scrollTo(0, 0)
}

/**
 * Mounts a Lenis smooth-scroll instance for the whole page. Renders nothing.
 * Skipped entirely under prefers-reduced-motion — native scrolling is the
 * reduced-motion behaviour.
 */
export function SmoothScroll() {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const lenis = new Lenis({ autoRaf: true, lerp: 0.12 })
    activeLenis = lenis
    return () => {
      lenis.destroy()
      activeLenis = null
    }
  }, [reduced])

  return null
}
