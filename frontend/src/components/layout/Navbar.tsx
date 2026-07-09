import { Menu, X } from "lucide-react"
import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"

const baseLinks = [
  { to: "/", label: "Home", index: "01" },
  { to: "/analyze", label: "Analyze", index: "02" },
  { to: "/live", label: "Live Listen", index: "03" },
  { to: "/how-it-works", label: "How It Works", index: "04" },
]

const historyLink = { to: "/history", label: "History", index: "05" }

export function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()

  const links = user ? [...baseLinks, historyLink] : baseLinks

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    navigate("/")
  }

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#08060d]/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <NavLink to="/" className="flex items-baseline gap-2.5 text-white" onClick={() => setOpen(false)}>
          <span className="font-serif text-xl italic leading-none text-violet-300">Voice</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/80">
            Fence
          </span>
        </NavLink>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "group flex items-baseline gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/50 transition-colors hover:text-white",
                  isActive && "text-white"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn("text-[9px]", isActive ? "text-violet-400" : "text-white/25 group-hover:text-violet-400/70")}>
                    {l.index}
                  </span>
                  {l.label}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          {!loading &&
            (user ? (
              <div className="flex items-center gap-3">
                <span
                  className="max-w-[140px] truncate font-mono text-[11px] text-white/50"
                  title={user.email}
                >
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="border border-white/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/70 transition-colors hover:border-rose-400/50 hover:text-rose-300"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <NavLink
                  to="/login"
                  className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60 transition-colors hover:text-white"
                >
                  Log in
                </NavLink>
                <NavLink
                  to="/signup"
                  className="border border-white/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition-colors hover:border-violet-400/60 hover:bg-violet-400/10"
                >
                  Sign up
                </NavLink>
              </div>
            ))}

          <NavLink
            to="/analyze"
            className="border border-white/20 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition-colors hover:border-violet-400/60 hover:bg-violet-400/10"
          >
            Run a check ↗
          </NavLink>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          className="text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-[#08060d]/95 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-baseline gap-2 px-3 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-white/60 transition-colors hover:bg-white/5 hover:text-white",
                    isActive && "bg-white/5 text-white"
                  )
                }
              >
                <span className="text-[9px] text-violet-400/70">{l.index}</span>
                {l.label}
              </NavLink>
            ))}
          </div>

          <div className="mt-3 border-t border-white/10 pt-3">
            {!loading &&
              (user ? (
                <div className="flex flex-col gap-2 px-3">
                  <span className="break-all font-mono text-[11px] text-white/50">
                    {user.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="border border-white/20 px-3 py-2.5 text-left font-mono text-xs uppercase tracking-[0.18em] text-white/70 transition-colors hover:border-rose-400/50 hover:text-rose-300"
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 px-3">
                  <NavLink
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="font-mono text-xs uppercase tracking-[0.18em] text-white/60 transition-colors hover:text-white"
                  >
                    Log in
                  </NavLink>
                  <NavLink
                    to="/signup"
                    onClick={() => setOpen(false)}
                    className="border border-white/20 px-3 py-2.5 text-center font-mono text-xs uppercase tracking-[0.18em] text-white transition-colors hover:border-violet-400/60 hover:bg-violet-400/10"
                  >
                    Sign up
                  </NavLink>
                </div>
              ))}
          </div>
        </div>
      )}
    </header>
  )
}
