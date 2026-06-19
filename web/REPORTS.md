# Cloakroom — build reports

## Report 1 — Motion / Framer Motion features used (honest, with locations)

Default feel: `MotionConfig` sets a global spring (`type:"spring", stiffness:200, damping:26`) in
`src/App.tsx`, so motion components spring by default across the app.

| # | Capability | Where (component · file) |
|---|---|---|
| 1 | motion components + spring transitions | MercuryButton, GlassPanel, MaskMorph, toggles — global default in `App.tsx` |
| 2 | `useScroll` | hero parallax `hero/Hero.tsx`; pipeline scrub `pipeline/Pipeline.tsx` |
| 3 | `useTransform` | `Hero.tsx` (auroraY/sceneY/contentY/fade/rotX/rotY/skew); `Pipeline.tsx` FlyStage (opacity/scale/y/blur) |
| 4 | `useSpring` | cursor smoothing `hooks/useCursor.tsx`; velocity `Hero.tsx`; rail draw `Pipeline.tsx` |
| 5 | scroll-scrubbing / scroll-linked | FlyStage layers driven by `scrollYProgress` in `Pipeline.tsx` |
| 6 | `whileInView` + `viewport={{once}}` | `how/HowItWorks.tsx`, `playground/Playground.tsx`, reduced-motion pipeline |
| 7 | `staggerChildren` / `delayChildren` | hero container variants `Hero.tsx`; chip stagger `Playground.tsx`; bento `HowItWorks.tsx` |
| 8 | layout animation / `layoutId` | shared-element morph raw value ↔ token chip in `hero/MaskMorph.tsx` |
| 9 | `AnimatePresence` | token/raw swap `MaskMorph.tsx`; result cards `Playground.tsx` |
| 10 | `whileHover` / `whileTap` | `MercuryButton.tsx`, `MotionToggle.tsx`, `SoundToggle.tsx`, `TokenChip.tsx`, draggable chip |
| 11 | `useMotionValue` + cursor tracking | pointer source `useCursor.tsx`; glass specular `ui/GlassPanel.tsx`; button sweep `MercuryButton.tsx` |
| 12 | `useMotionValueEvent` | stage-threshold change + sound cue in `Pipeline.tsx` |
| 13 | Variants orchestration | scene choreography `Hero.tsx`; `Playground.tsx`; `HowItWorks.tsx` |
| 14 | `useVelocity` | scroll velocity → momentum skew in `Hero.tsx` |
| 15 | `useInView` | lazy-trigger WebGL hero `Hero.tsx`; trigger seal sequence `footer/SealFooter.tsx` |
| 16 | animated SVG `pathLength` | progress rail `motion.line` in `Pipeline.tsx` (Rail) |
| 17 | `useAnimate` / timeline sequencing | vault-door seal sequence array in `SealFooter.tsx` |
| 18 | `drag` / `dragConstraints` | draggable token chips (`dragSnapToOrigin`, `whileDrag`) in `Playground.tsx` (MaskedBody) |
| 19 | exit/enter blur+scale (dematerialize) | dissolve variants in `MaskMorph.tsx` |
| 20 | `MotionConfig reducedMotion` | `App.tsx` (mode user / always / never, wired to the visible toggle) |
| 21 | `useMotionTemplate` | cursor-tracked specular gradient in `GlassPanel.tsx` |
| 22 | `useReducedMotion` | OS preference read in `MotionToggle.tsx` |

22 distinct capabilities in use (target was 15). R3F is confined to the hero (`VaultScene.tsx`);
everything else is Framer Motion + CSS 3D transforms.

## Report 2 — Inspiration cues translated (shotdeck · savee · cosmos)

**shotdeck.com — cinematic grade & lighting (discipline, not copy):**
- Single warm key light from top-center over a cool fill — `body::before` radial gradients
  (`index.css`) and the R3F `spotLight #f0dcb4` + `pointLight #8fa0c0` (`VaultScene.tsx`).
- Graded blacks, never pure #000 (`#06070A → #0B0D14`) — lifted-shadow film look.
- Film grain + vignette overlay (`ui/Grain.tsx`) gives the texture of a graded still and kills banding.
- Cinematic letterbox bars frame the hero (top/bottom gradient bars in `Hero.tsx`).

**savee.com — negative space & curated calm:**
- Apple-grade air: five single-purpose sections, `py-28` rhythm, one idea per fold.
- Restraint discipline: one hero material (glass), monochrome chrome, saturation reserved for data;
  section labels used deliberately (not an eyebrow over every heading).
- Quiet-confidence typography: large type-scale contrast, wide tracking on small-caps labels,
  balanced headings — Bricolage Grotesque carrying weight contrast rather than a font pile-up.
- Calm asymmetric bento in `HowItWorks.tsx` (varied tile sizes, generous air, no identical-card grid).

**cosmos.co — immersive depth & moodboard-as-world:**
- Multi-layer parallax diorama in the hero — aurora, WebGL slab, and foreground content move at
  different rates on scroll and on cursor tilt (`Hero.tsx` + `useCursor.tsx`).
- Soft-focus depth: blur at the edges of each pipeline window (`FlyStage`) and the dematerialize
  dissolve (`MaskMorph.tsx`) read as rack-focus.
- Layered translucency (frosted glass over volumetric glow) for "inside a curated world" depth.
- Scroll-scrubbed depth push through the pipeline (scale + y + blur) — flying through layers, not
  scrolling past sections.

**Honest caveat:** no photographic imagery is used. Per the brand register, the imagery here is the
refractive WebGL scene, the glass material, and the live data visualisation — appropriate for a
security-infrastructure brand, where stock photography would read as generic.
