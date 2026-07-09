# Voicefence — Frontend (Phase 4)

React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui client for the
`backend/` API (`POST /analyze`, `WS /ws/live-analyze`). Four pages:

| Route | Page | Talks to |
|---|---|---|
| `/` | Landing | — (marketing/explainer) |
| `/analyze` | Analyze | `POST /analyze` |
| `/live` | Live Listen | `WS /ws/live-analyze` (mic capture) |
| `/how-it-works` | How It Works | — (static, real numbers from `ml/README.md`) |

## Local setup

```powershell
cd frontend
npm install
cp .env.example .env   # edit VITE_API_URL if the backend isn't on localhost:8000
npm run dev
```

Requires `backend/` running (see `../backend/README.md`) for the Analyze
and Live Listen pages to do anything — the Landing and How It Works pages
work standalone.

## Design system

- **shadcn/ui**, Radix base, Nova preset (Geist font, Lucide icons),
  neutral base color. Components live in `src/components/ui/` — the
  default shadcn path, kept as-is (see "why this matters" below).
- **Two custom components** (`web-gl-shader.tsx`, `liquid-glass-button.tsx`)
  provide the hero's animated WebGL background and the liquid-glass CTA
  button. `liquid-glass-button.tsx` was trimmed on integration to drop a
  duplicate `Button`/`buttonVariants` definition that shadowed the
  shadcn-generated `button.tsx` — only `LiquidButton`, `GlassFilter`, and
  the bonus `MetalButton` are unique to that file.
- **Design decision:** the animated shader background is used only on the
  Landing page's hero (and could extend to How It Works, a marketing-ish
  page) — deliberately *not* on Analyze/Live Listen, where a calmer,
  static dark background keeps focus on reading a score or watching a
  live meter. Same color tokens, typography, and button components
  everywhere for cohesion; the animated flourish is reserved for where it
  helps rather than distracts.

### Why `/components/ui` matters

shadcn's CLI defaults to `src/components/ui` for a reason worth keeping:
every shadcn component assumes its sibling components and the `cn()`
helper (`src/lib/utils.ts`) are resolvable at fixed alias paths (`@/lib/utils`,
`@/components/ui/*`). Moving that folder means either patching every
generated component's imports by hand or breaking the `npx shadcn add`
workflow for any component you add later. This project uses the default
path — no patching needed, `npx shadcn add <component>` just works.

## Testing this build

Verified via a headless Playwright script (not committed — one-off,
see the session's scratch dir) against a running dev server + backend:
- All four routes render with no console errors.
- Real file upload through `/analyze` → verdict, scores, and the
  per-window chart matched the backend's actual response exactly
  (down to score_min/mean/threshold).
- Caught and fixed two real bugs this way: the shader's `fixed`
  positioning bled past the hero into every section below it on scroll
  (now `absolute`, confined to its own container via a `ResizeObserver`
  instead of `window.innerWidth/innerHeight`), and the shader's bright
  streak blew out the hero text (fixed with a radial dark vignette
  layered between the canvas and the text, not by editing the shader's
  own math).

**Not verified by this pass:** actual microphone capture on Live Listen —
headless Chromium has no real mic input to feed it. The resample/PCM16/
chunking logic was code-reviewed carefully (matches the wire protocol in
`backend/app/routes/stream.py` exactly) but hasn't been exercised with a
live mic in a real browser. Worth a manual check before relying on it.

## Building for deployment

```powershell
npm run build   # outputs dist/
```

Set `VITE_API_URL` to the deployed backend's URL at build time (Vite
inlines `import.meta.env.VITE_*` at build, not runtime) — e.g. for a
static host:

```powershell
$env:VITE_API_URL="https://your-backend.onrender.com"; npm run build
```
