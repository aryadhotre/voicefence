import { useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { AlertTriangle } from "lucide-react"
import { motion } from "motion/react"
import { Kicker, Ticks } from "@/components/ui/dossier"
import { AuthField } from "@/components/auth/AuthField"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? "/"

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await signIn(email, password)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
    } else {
      navigate(from, { replace: true })
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16 md:px-8 md:py-24">
      <Kicker label="Account access" />
      <h1 className="mt-6 font-serif text-4xl leading-tight text-white md:text-5xl">
        Log <em className="italic text-violet-300">in.</em>
      </h1>
      <p className="mt-4 text-white/55">
        Sign in to save analysis results to your history. Detection itself
        never requires an account.
      </p>

      <motion.form
        onSubmit={onSubmit}
        className="relative mt-10 flex flex-col gap-5 border border-white/12 bg-white/[0.02] p-6 md:p-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        noValidate
      >
        <Ticks />

        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <div className="flex items-start gap-3 border border-rose-500/30 bg-rose-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <p className="text-xs text-rose-200/80">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "mt-2 border border-white/25 bg-white/[0.04] px-8 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-white transition-colors hover:border-violet-400/70 hover:bg-violet-400/10",
            submitting && "pointer-events-none opacity-50"
          )}
        >
          {submitting ? "Signing in…" : "Log in →"}
        </button>

        <p className="text-center font-mono text-[11px] uppercase tracking-[0.15em] text-white/40">
          No account?{" "}
          <Link to="/signup" className="text-violet-300 transition-colors hover:text-violet-200">
            Sign up
          </Link>
        </p>
      </motion.form>
    </div>
  )
}
