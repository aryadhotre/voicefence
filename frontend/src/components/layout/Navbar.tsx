import { Menu, X } from "lucide-react"
import { useState } from "react"
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"

const links = [
  { to: "/", label: "Home", index: "01" },
  { to: "/analyze", label: "Analyze", index: "02" },
  { to: "/live", label: "Live Listen", index: "03" },
  { to: "/how-it-works", label: "How It Works", index: "04" },
]

export function Navbar() {
  const [open, setOpen] = useState(false)

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

        <NavLink
          to="/analyze"
          className="hidden border border-white/20 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition-colors hover:border-violet-400/60 hover:bg-violet-400/10 md:inline-block"
        >
          Run a check ↗
        </NavLink>

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
        </div>
      )}
    </header>
  )
}
