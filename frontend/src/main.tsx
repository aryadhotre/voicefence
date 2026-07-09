import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { AuthProvider } from './lib/auth'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {/* reducedMotion="user": every motion.* transform/layout animation in
            the app collapses to a plain fade when the OS-level
            prefers-reduced-motion setting is on. Custom JS-driven effects
            (Lenis, cursor glow, count-ups, canvas waveform) each check
            useReducedMotion() themselves. */}
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
