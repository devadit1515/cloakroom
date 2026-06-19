# Cloakroom — landing & live demo

A "liquid obsidian" marketing + live-demo experience for Cloakroom, the cloud-agnostic
PII/PHI/PFI masking middleware. Built with React + Vite + TypeScript, Tailwind, Framer
Motion (motion.dev), React Three Fiber (hero only), and Lenis.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the built bundle
```

## Live vs mocked

The playground calls `POST /process` on the real Cloakroom service and falls back **silently**
to an in-browser mirror of the pipeline if the server is unreachable — both return the identical
shape, so the demo looks flawless with no backend running.

- Point at a running backend in dev via the Vite proxy (defaults to `http://localhost:8000`):
  `CLOAKROOM_API=http://localhost:8000 npm run dev`
- Or at build/runtime set `VITE_CLOAKROOM_API` to an absolute API base URL.

The mock pipeline lives in `src/lib/mock.ts` (detect → mask → reason → unmask, mirroring the
real token format `[PFI_ACCOUNT_1]`). The fallback is wired in `src/lib/api.ts`.

## Structure

```
src/
  App.tsx                     # providers, MotionConfig, Lenis, sections
  lib/                        # types, mock pipeline, api client, hero sample, sound
  hooks/                      # Lenis smooth scroll, shared cursor source
  components/
    ui/                       # GlassPanel, MercuryButton, TokenChip, toggles, Grain
    hero/                     # Hero, MaskMorph (signature transition), VaultScene (R3F, lazy)
    pipeline/                 # scroll-scrubbed Detect → Mask → Reason → Unmask
    playground/               # live proof — 3 synced glass cards
    how/                      # cloud-agnostic bento
    footer/                   # sealing vault door
```

## Performance & accessibility

- WebGL hero is `React.lazy` code-split and only mounts on capable desktops (≥1024px, fine pointer).
- Animations are limited to transform / opacity / filter (GPU-composited).
- Token category is conveyed by colour **and** text label, never colour alone.
- Motion and sound are always on in this build (the in-page toggles were removed by request).
  The reduced-motion code paths still exist in components if `prefers-reduced-motion` support is
  reinstated later — `MotionConfig reducedMotion` in `App.tsx` is the single switch.

Design system: see `PRODUCT.md` and `DESIGN.md`. Motion-feature and inspiration reports: see
`REPORTS.md`.
