import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface AuthResult {
  error: string | null
  needsConfirmation?: boolean
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Supabase's auth error messages are either too generic (doesn't distinguish
// wrong password from unknown email, by design, to avoid leaking which
// emails are registered) or too raw to show directly. Map the common ones;
// pass anything unrecognized through as-is (e.g. the weak-password message
// is already clear on its own).
function mapAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("invalid login credentials")) return "Incorrect email or password."
  if (m.includes("already registered") || m.includes("user already exists"))
    return "An account with this email already exists — try logging in instead."
  if (m.includes("email not confirmed"))
    return "Please confirm your email first — check your inbox for the confirmation link."
  if (m.includes("rate limit")) return "Too many attempts. Please wait a moment and try again."
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? mapAuthError(error.message) : null }
  }

  const signUp = async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: mapAuthError(error.message) }
    // If email confirmation is required on this project, signUp succeeds but
    // returns no session — the account can't log in until the link is clicked.
    return { error: null, needsConfirmation: !data.session }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
