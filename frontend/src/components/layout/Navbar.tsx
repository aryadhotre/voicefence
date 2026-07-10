import { Menu, X } from "lucide-react"
import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"

const baseLinks = [
  { to: "/", label: "Home" },
  { to: "/analyze", label: "Analyze" },
  { to: "/live", label: "Live Listen" },
  { to: "/how-it-works", label: "How It Works" },
]

const historyLink = { to: "/history", label: "History" }

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
    <header className="fixed top-0 z-50 w-full border-b border-white/[0.06] bg-[#08060d]/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <NavLink
          to="/"
          className="text-[17px] font-semibold tracking-tight text-white"
          onClick={() => setOpen(false)}
        >
          Voicefence<span className="text-violet-400">.</span>
        </NavLink>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "text-[13px] font-medium text-white/55 transition-colors hover:text-white",
                  isActive && "text-white"
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {!loading &&
            (user ? (
              <div className="flex items-center gap-3">
                <span
                  className="max-w-[140px] truncate text-[13px] text-white/50"
                  title={user.email}
                >
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="rounded-full border border-white/15 px-4 py-1.5 text-[13px] font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <NavLink
                  to="/login"
                  className="text-[13px] font-medium text-white/60 transition-colors hover:text-white"
                >
                  Log in
                </NavLink>
                <NavLink
                  to="/signup"
                  className="rounded-full border border-white/15 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-white/30"
                >
                  Sign up
                </NavLink>
              </div>
            ))}

          <NavLink
            to="/analyze"
            className="rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-black transition-colors hover:bg-white/85"
          >
            Run a check
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
        <div className="border-t border-white/[0.06] bg-[#08060d]/95 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white",
                    isActive && "bg-white/5 text-white"
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>

          <div className="mt-3 border-t border-white/[0.06] pt-3">
            {!loading &&
              (user ? (
                <div className="flex flex-col gap-2 px-3">
                  <span className="break-all text-[13px] text-white/50">{user.email}</span>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="rounded-full border border-white/15 px-4 py-2.5 text-left text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 px-3">
                  <NavLink
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium text-white/60 transition-colors hover:text-white"
                  >
                    Log in
                  </NavLink>
                  <NavLink
                    to="/signup"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-white/15 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:border-white/30"
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
