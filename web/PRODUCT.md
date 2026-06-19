# Product

## Register

brand

## Users
Engineering and compliance leaders at regulated enterprises (healthcare, fintech, insurance)
evaluating how to use third-party / hosted LLMs over data containing PII, PHI, and PFI without
leaking raw values. They arrive skeptical (did you send our account numbers to an AI API?) and
need to *see* that raw data never reaches the model. The page is the proof.

## Product Purpose
Cloakroom is cloud-agnostic masking middleware that sits in front of any LLM call and runs
detect -> mask -> reason -> unmask. Sensitive spans are swapped for stable placeholder tokens
(e.g. [PFI_ACCOUNT_1]) before the model sees anything; the model reasons over tokens; real
values are restored only in the final answer. Outcome: HIPAA / PCI-DSS / GDPR / DPDP posture
with zero raw-data exposure and zero paid API keys. The landing page must make this legible and
visceral through one signature interaction (raw value <-> glass token) and a live, working
playground backed by the real POST /process endpoint (with a flawless mocked fallback).

## Brand Personality
Quiet authority. Engineered, exact, expensive. Three words: weighty, refractive, exact.
The voice is calm and declarative (Your data never meets the model.), never salesy or loud.
Confidence is shown through restraint and material quality, not adjectives.

## Anti-references
- Generic dev-tool SaaS: purple-on-white gradients, hero-metric templates, identical icon-card grids.
- Editorial-magazine affectation: display-serif + italic drop caps + ruled three-column broadsheet.
- Neon/cyber security cliches: matrix green, glitch, lock-icon spam, candy-bright dashboards.
- Glassmorphism sprinkled everywhere as decoration. Here glass is THE one hero material, used with intent.

## Design Principles
1. Show, don't claim. The promise (raw data never reaches the model) is demonstrated live --
   the masked payload is visible and provably token-only -- not asserted in copy.
2. One material, obsessively. Liquid glass over warm obsidian is the entire surface language.
   Richness comes from light, depth, and space -- not from stacking effects.
3. The transition is the product. The raw<->token dematerialization is the soul; every other
   moment defers to it. One hero effect per section; if a second appears, cut it.
4. Restraint is the luxury. Apple-grade negative space, few elements, perfect alignment.
5. Color is meaning. Saturation appears only on data -- PII amethyst, PHI teal, PFI champagne.
   The chrome stays monochrome obsidian + mercury.

## Accessibility & Inclusion
WCAG 2.2 AA. Body text >= 4.5:1 on obsidian; large/display >= 3:1. Full keyboard focus states on
glass controls. prefers-reduced-motion is honored globally (MotionConfig reducedMotion=user) with
crossfade/instant fallbacks for the dematerialize and scroll-scrub effects, plus a visible in-page
motion toggle. Category meaning is never conveyed by color alone -- every token carries its category
label as text. Sound is opt-in and muted by default.
