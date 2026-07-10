import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AlertTriangle, MailCheck } from "lucide-react"
import { motion } from "motion/react"
import { Kicker } from "@/components/ui/dossier"
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
          className="relative mt-10 flex flex-col items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <MailCheck className="h-8 w-8 text-violet-300" strokeWidth={1.5} />
          <p className="text-lg font-semibold tracking-tight text-white">
            Check your inbox
          </p>
          <p className="text-sm text-white/55">
            We sent a confirmation link to <span className="text-white/85">{email}</span>.
            Click it, then come back and log in.
          </p>
          <Link
            to="/login"
            className="mt-2 rounded-full bg-white px-7 py-3 text-[15px] font-medium text-black transition-colors hover:bg-white/85"
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
      <h1 className="mt-6 text-4xl leading-tight text-white md:text-5xl">
        Sign up<span className="text-violet-400">.</span>
      </h1>
      <p className="mt-4 text-white/55">
        Create an account to keep a history of your analysis results.
        Detection itself never requires an account.
      </p>

      <motion.form
        onSubmit={onSubmit}
        className="relative mt-10 flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 md:p-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        noValidate
      >
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
          <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <p className="text-xs text-rose-200/80">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "mt-2 rounded-full bg-white px-8 py-3.5 text-[15px] font-medium text-black transition-colors hover:bg-white/85",
            submitting && "pointer-events-none opacity-50"
          )}
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>

        <p className="text-center text-[13px] text-white/40">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-violet-300 transition-colors hover:text-violet-200">
            Log in
          </Link>
        </p>
      </motion.form>
    </div>
  )
}
