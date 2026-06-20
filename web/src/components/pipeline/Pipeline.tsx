import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "framer-motion";
import { TokenChip } from "../ui/TokenChip";
import { GlassPanel } from "../ui/GlassPanel";
import { SectionLabel } from "../ui/SectionLabel";
import { useMotionPref } from "../ui/MotionToggle";
import { getLenis } from "../../hooks/useLenis";
import { CATEGORY_META, type Category } from "../../lib/types";

const TOKEN_SPLIT = /(\[(?:PII|PHI|PFI)_[A-Z]+_\d+\])/g;

/** Render a string, turning any token substring into a glass chip. */
function withChips(text: string): ReactNode[] {
  return text.split(TOKEN_SPLIT).map((part, i) => {
    const m = /^\[(PII|PHI|PFI)_/.exec(part);
    if (m) return <TokenChip key={i} token={part} category={m[1] as Category} size="md" className="mx-1.5 my-1" />;
    return (
      <span key={i} className="text-mercury/60">
        {part}
      </span>
    );
  });
}

const DETECTED = [
  { raw: "Prachan Mehta", cat: "PII" as Category },
  { raw: "002233445566", cat: "PFI" as Category },
  { raw: "₹84,500", cat: "PFI" as Category },
  { raw: "diabetes", cat: "PHI" as Category },
];

const MASKED_LINE = "Prachan Mehta → [PII_PERSON_1] · 002233445566 → [PFI_ACCOUNT_1] · ₹84,500 → [PFI_AMOUNT_1] · diabetes → [PHI_CONDITION_1]";
const REASON_LINE = "Customer [PII_PERSON_1] holds [PFI_ACCOUNT_1]; the [PFI_AMOUNT_1] order matches prior activity. [PHI_CONDITION_1] care noted, no anomaly.";
const RESTORED_LINE = "Customer Prachan Mehta holds ICICI account 002233445566. The ₹84,500 order is consistent with prior activity; diabetes care is noted. No anomaly detected.";

// Captions kept to ~2 lines each so the four stages read at the same rhythm.
const STAGES: { title: string; caption: string; body: ReactNode }[] = [
  {
    title: "Detect",
    caption: "Format rules catch IDs, accounts and amounts; NER catches names and conditions.",
    body: (
      <div className="flex flex-wrap items-center gap-4">
        {DETECTED.map((d) => (
          <span
            key={d.raw}
            className="inline-flex items-center gap-2.5 rounded-full px-4 py-2 font-mono text-[14px]"
            style={{ color: CATEGORY_META[d.cat].hex, border: `1px dashed ${CATEGORY_META[d.cat].hex}55`, background: "rgba(202,212,228,0.03)" }}
          >
            {d.raw}
            <span className="text-[10px] uppercase tracking-[0.16em] opacity-60">{d.cat}</span>
          </span>
        ))}
      </div>
    ),
  },
  {
    title: "Mask",
    caption: "Every value becomes a stable token — same value, same token, so relationships survive.",
    body: <p className="flex flex-wrap items-center gap-y-1 font-mono text-[14px] leading-loose">{withChips(MASKED_LINE)}</p>,
  },
  {
    title: "Reason",
    caption: "Only tokens leave your environment — the model never sees a raw value.",
    body: <p className="flex flex-wrap items-center gap-y-1 font-mono text-[14px] leading-loose">{withChips(REASON_LINE)}</p>,
  },
  {
    title: "Unmask",
    caption: "Tokens swap back from the encrypted vault — the finished answer, for your eyes only.",
    body: <p className="text-[clamp(1.05rem,1.7vw,1.3rem)] leading-relaxed text-mercury-bright">{RESTORED_LINE}</p>,
  },
];

const N = STAGES.length;
const SEG = 1 / (N - 1); // scroll span between two adjacent stages
const HOLD = 0.36 * SEG; // half-width of the clear "hold" plateau around each stage

function StagePanel({ children, stacked = false }: { children: ReactNode; stacked?: boolean }) {
  return (
    <GlassPanel
      className={`glass-strong flex w-full max-w-4xl flex-col justify-center px-8 py-10 sm:px-14 sm:py-16 ${stacked ? "" : "h-full"}`}
      specular={false}
    >
      {children}
    </GlassPanel>
  );
}

function StageHeader({ index, title, caption }: { index: number; title: string; caption: string }) {
  return (
    <>
      <div className="mb-6 flex items-baseline gap-4">
        <span className="font-mono text-sm text-mercury-deep">
          0{index + 1}
          <span className="text-mercury-deep/45"> / 0{N}</span>
        </span>
        <h3 className="font-display text-[clamp(2rem,4.5vw,3rem)] font-semibold tracking-[-0.025em] text-mercury-bright">
          {title}
        </h3>
      </div>
      <p className="mb-9 max-w-lg text-pretty text-[clamp(1rem,1.5vw,1.15rem)] leading-relaxed text-mercury/75">
        {caption}
      </p>
    </>
  );
}

/** A scroll-scrubbed layer. Opacity, a slight blur, scale and rise are all driven
 *  continuously by scroll position, so stages glide and morph between each other
 *  instead of snapping point-to-point. */
function StageLayer({ progress, index, children }: { progress: MotionValue<number>; index: number; children: ReactNode }) {
  const c = index * SEG;
  // 4-stop keyframes: morph in -> CLEAR HOLD (sharp, still) -> morph out.
  const range = [c - SEG + HOLD, c - HOLD, c + HOLD, c + SEG - HOLD];
  const opacity = useTransform(progress, range, [0, 1, 1, 0]);
  const y = useTransform(progress, range, [30, 0, 0, -30]);
  const scale = useTransform(progress, range, [1.03, 1, 1, 0.97]);
  const filter = useTransform(progress, range, ["blur(8px)", "blur(0px)", "blur(0px)", "blur(8px)"]);
  return (
    <motion.div style={{ opacity, y, scale, filter }} className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {children}
    </motion.div>
  );
}

function Rail({ active, fill, onJump }: { active: number; fill: MotionValue<string>; onJump: (i: number) => void }) {
  return (
    <div className="relative hidden h-[clamp(300px,46vh,440px)] w-44 shrink-0 lg:block">
      <div className="absolute left-[5px] top-0 h-full w-px bg-mercury/15" />
      <motion.div className="absolute left-[5px] top-0 w-px bg-mercury-bright/70" style={{ height: fill }} />
      {STAGES.map((s, i) => (
        <button
          key={s.title}
          type="button"
          onClick={() => onJump(i)}
          aria-current={i === active}
          className="group absolute left-0 flex items-center gap-3.5 focus-visible:outline-2"
          style={{ top: `calc(${(i / (N - 1)) * 100}% - 6px)` }}
        >
          <span
            className="h-3 w-3 shrink-0 rounded-full border transition-all duration-300"
            style={
              i === active
                ? { background: "#EAF0F8", borderColor: "transparent", boxShadow: "0 0 14px 2px rgba(234,240,248,0.55)" }
                : { background: "transparent", borderColor: "rgba(140,151,171,0.4)" }
            }
          />
          <span
            className={`font-mono text-[13px] tracking-wide transition-colors duration-300 ${
              i === active ? "text-mercury-bright" : "text-mercury-deep group-hover:text-mercury/80"
            }`}
          >
            {s.title}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Pipeline() {
  const { reduced } = useMotionPref();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);

  // Rail fill tracks scroll continuously; the highlighted dot snaps to the nearest stage.
  const railFill = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(N - 1, Math.max(0, Math.round(v * (N - 1)))));
  });

  // Clicking the rail glides to a stage (same smooth scroll as the rest of the page).
  const goTo = (i: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(N - 1, i));
    const travel = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const targetY = top + (target / (N - 1)) * travel;
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(targetY, { duration: 0.8 });
    else window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  if (reduced) {
    // Accessible fallback: a calm stacked sequence, no pin, no scrub.
    return (
      <section id="pipeline" className="mx-auto max-w-5xl px-6 py-28">
        <SectionLabel>The pipeline</SectionLabel>
        <h2 className="mb-12 mt-5 font-display text-[clamp(2rem,5vw,3.2rem)] font-semibold tracking-[-0.025em] text-mercury-bright">
          Detect. Mask. Reason. Unmask.
        </h2>
        <div className="flex flex-col gap-6">
          {STAGES.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
              <StagePanel stacked>
                <StageHeader index={i} title={s.title} caption={s.caption} />
                {s.body}
              </StagePanel>
            </motion.div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="pipeline" ref={sectionRef} className="relative" style={{ height: "180vh" }}>
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-10 px-6">
          <Rail active={active} fill={railFill} onJump={goTo} />
          <div className="relative min-h-[clamp(380px,58vh,560px)] flex-1">
            {STAGES.map((s, i) => (
              <StageLayer key={s.title} progress={scrollYProgress} index={i}>
                <StagePanel>
                  <StageHeader index={i} title={s.title} caption={s.caption} />
                  {s.body}
                </StagePanel>
              </StageLayer>
            ))}
          </div>
        </div>
        <div className="absolute left-6 top-24 z-[5] sm:left-10">
          <SectionLabel>The pipeline</SectionLabel>
        </div>
      </div>
    </section>
  );
}
