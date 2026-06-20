import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform, type Variants } from "framer-motion";
import { MaskMorph } from "./MaskMorph";
import { MercuryButton } from "../ui/MercuryButton";
import { GlassPanel } from "../ui/GlassPanel";
import { useMotionPref } from "../ui/MotionToggle";
import { scrollToId } from "../../hooks/useLenis";
import { HERO_SEGMENTS } from "../../lib/sample";

const TRUST = ["HIPAA", "PCI-DSS", "GDPR", "DPDP", "zero paid keys"];

// On-load reveal only — opacity + small rise, no blur, no parallax.
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 20 } },
};

export function Hero() {
  const { reduced } = useMotionPref();
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "0px" });

  // signature interaction — auto-cycle mask/unmask, re-triggerable by the control
  const [masked, setMasked] = useState(true);
  useEffect(() => {
    if (reduced || !inView) return;
    const id = setInterval(() => setMasked((m) => !m), 3800);
    return () => clearInterval(id);
  }, [reduced, inView]);

  // The only scroll effect: the hero gently fades as you scroll past it. No parallax.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={sectionRef}
      id="vault"
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-24"
    >
      {/* static aurora / volumetric light (no parallax) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute left-1/2 top-[40%] h-[64vmin] w-[88vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(216,184,126,0.15), transparent 64%)", filter: "blur(22px)" }}
        />
      </div>

      {/* content — wide column that fills the page */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        style={{ opacity: fade }}
        className="relative z-[10] mx-auto flex w-full max-w-5xl flex-col items-center text-center"
      >
        <motion.p variants={rise} className="label mb-6 text-mercury-deep">
          Cloud-agnostic masking middleware
        </motion.p>

        <motion.h1
          variants={rise}
          className="text-balance font-display font-semibold leading-[0.95] tracking-[-0.03em] text-mercury-bright"
          style={{ fontSize: "clamp(3rem, 9vw, 6rem)" }}
        >
          Your data never meets the model.
        </motion.h1>

        <motion.p
          variants={rise}
          className="mt-6 max-w-2xl text-pretty text-[clamp(1.05rem,2.4vw,1.3rem)] leading-relaxed text-mercury/85"
        >
          Cloakroom swaps every sensitive value for a stable glass token before your LLM sees a
          thing — then restores the real answer for you alone.
        </motion.p>

        {/* the live record — mask/unmask playing on real sample data */}
        <motion.div variants={rise} className="mt-10 w-full max-w-3xl">
          <GlassPanel className="px-6 py-6 sm:px-8 sm:py-7" specular style={{ background: "rgba(9,11,17,0.72)" }}>
            <div className="mb-4 flex items-center justify-between">
              <span className="label text-mercury-deep/90">live record</span>
              <button
                type="button"
                onClick={() => setMasked((m) => !m)}
                className="font-mono text-[12px] text-mercury/70 underline-offset-4 hover:text-mercury-bright hover:underline focus-visible:outline-2"
              >
                {masked ? "reveal →" : "← mask"}
              </button>
            </div>
            <p className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-left font-mono text-[clamp(0.9rem,2vw,1.05rem)] leading-[2.2] text-mercury/80">
              {HERO_SEGMENTS.map((seg, i) =>
                seg.token && seg.category ? (
                  <MaskMorph key={i} raw={seg.raw} token={seg.token} category={seg.category} masked={masked} size="md" />
                ) : (
                  <span key={i} className="whitespace-pre-wrap text-mercury/55">
                    {seg.raw}
                  </span>
                )
              )}
            </p>
          </GlassPanel>
        </motion.div>

        <motion.div variants={rise} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <MercuryButton onClick={() => scrollToId("playground")}>Cloak a record</MercuryButton>
          <MercuryButton variant="ghost" onClick={() => scrollToId("pipeline")}>
            See how it works
          </MercuryButton>
        </motion.div>

        <motion.div variants={rise} className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {TRUST.map((t, i) => (
            <span key={t} className="flex items-center gap-3">
              {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-mercury/30" />}
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-mercury-deep">{t}</span>
            </span>
          ))}
        </motion.div>
      </motion.div>

      {/* scroll hint */}
      <motion.div aria-hidden className="absolute bottom-7 left-1/2 z-[11] -translate-x-1/2" style={{ opacity: fade }}>
        <motion.div
          className="h-9 w-[1px] bg-gradient-to-b from-mercury/60 to-transparent"
          initial={{ opacity: 0.2 }}
          animate={{ opacity: reduced ? 0.5 : [0.2, 0.7, 0.2] }}
          transition={reduced ? {} : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
    </section>
  );
}
