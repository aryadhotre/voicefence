import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AlertTriangle, MailCheck } from "lucide-react"
import { motion } from "motion/react"
import { Kicker, Ticks } from "@/components/ui/dossier"
import { AuthField } from "@/components/auth/AuthField"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

const MIN_PASSWORD_LENGTH = 6

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setSubmitting(true)
    const result = await signUp(email, password)
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
    } else if (result.needsConfirmation) {
      setNeedsConfirmation(true)
    } else {
      navigate("/", { replace: true })
    }
  }

  if (needsConfirmation) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 md:px-8 md:py-24">
        <Kicker label="Account access" />
        <motion.div
          className="relative mt-10 flex flex-col items-center gap-4 border border-white/12 bg-white/[0.02] p-8 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Ticks />
          <MailCheck className="h-8 w-8 text-violet-300" strokeWidth={1.5} />
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white">
            Check your inbox
          </p>
          <p className="text-sm text-white/55">
            We sent a confirmation link to <span className="text-white/85">{email}</span>.
            Click it, then come back and log in.
          </p>
          <Link
            to="/login"
            className="mt-2 border border-white/25 bg-white/[0.04] px-7 py-3 font-mono text-xs uppercase tracking-[0.2em] text-white transition-colors hover:border-violet-400/70 hover:bg-violet-400/10"
          >
            Go to login
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16 md:px-8 md:py-24">
      <Kicker label="Account access" />
      <h1 className="mt-6 font-serif text-4xl leading-tight text-white md:text-5xl">
        Sign <em className="italic text-violet-300">up.</em>
      </h1>
      <p className="mt-4 text-white/55">
        Create an account to keep a history of your analysis results.
        Detection itself never requires an account.
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
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <AuthField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          {submitting ? "Creating account…" : "Sign up →"}
        </button>

        <p className="text-center font-mono text-[11px] uppercase tracking-[0.15em] text-white/40">
          Already have an account?{" "}
          <Link to="/login" className="text-violet-300 transition-colors hover:text-violet-200">
            Log in
          </Link>
        </p>
      </motion.form>
    </div>
  )
}
