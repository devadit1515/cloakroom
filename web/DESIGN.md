# Design

## Theme
Liquid obsidian. A dark, cinematic vault interior lit by a single warm key light from top-center,
with one cool platinum-mercury accent as the light source for primary actions. Mood: stepping into
a refractive glass vault in another world. Color-graded-film discipline (deep blacks that are never
pure 000, controlled highlights, subtle grain to kill banding).

## Color (the only saturated color lives on data)
- Base gradient: 06070A -> 0B0D14 (obsidian), warm undertone, never pure black.
- Surface (glass): translucent white at 4-8 percent over obsidian, backdrop-blur, 1px top
  light-catching border (rgba 234,240,248,0.14), faint iridescent edge sheen on hover.
- Ink: EAF0F8 headlines; C8D2E0 body (>=4.5:1 on obsidian); 8C97AB muted labels (labels/large only).
- Accent: mercury C8D2E0 / bright EAF0F8 -- primary actions, light sources. One jewel accent max.
- Category (ONLY on tokens/data): PII amethyst B197D6, PHI teal 5FB3A8, PFI champagne DCB87E.

## Typography
- Display + UI: Bricolage Grotesque (one family, weight/size contrast -- 600/700 display, 300/400
  body, 500 labels with 0.34em tracking). Distinctive; deliberately NOT Fraunces/Inter/Space-Grotesk
  and NOT the editorial-serif lane.
- Data + tokens: JetBrains Mono -- renders token chips [PFI_ACCOUNT_1] and real values. Semantic, not decorative.
- Scale: fluid clamp(), ratio >=1.25; hero display max <= 6rem; tracking floor >= -0.03em;
  text-wrap balance on headings. Light-on-dark line-height +0.05-0.1.

## Material -- liquid glass (the hero material, ~6mm thick)
backdrop-blur(20-28px) + translucent fill + inset top highlight + soft ambient-occlusion drop shadow
beneath + cursor-tracked specular highlight. Hero centerpiece is a real refractive WebGL slab
(R3F + drei MeshTransmissionMaterial, environment map) -- WebGL is hero-only; everything else is CSS
3D transforms (perspective / rotateX-Y / translateZ).

## Motion
Spring physics by default (type spring, tuned stiffness/damping); ease-out curves elsewhere.
Lenis smooth scroll. Signature: raw value scrambles -> dissolves (blur+scale+opacity exit) ->
re-condenses as a glass token via shared-element layoutId; reverse on unmask. Pipeline is
scroll-scrubbed (useScroll + useSpring) as a 4-layer depth push (Detect->Mask->Reason->Unmask).
Reduced-motion: crossfades/instant, no transforms. Animate only transform/opacity/filter.

## Layout & Space
Apple-grade negative space; ~5 single-purpose sections; 12-col fluid grid with intentional asymmetry.
Subtle film grain overlay site-wide. Cinematic letterbox framing on the hero and the pipeline.

## Z-index scale
scene(0) -> content(10) -> chrome(40) -> overlay(60) -> grain(90).
