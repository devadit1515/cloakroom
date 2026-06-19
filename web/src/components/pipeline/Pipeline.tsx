import { useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { TokenChip } from "../ui/TokenChip";
import { GlassPanel } from "../ui/GlassPanel";
import { SectionLabel } from "../ui/SectionLabel";
import { useMotionPref } from "../ui/MotionToggle";
import { playSeal } from "../../lib/sound";
import { CATEGORY_META, type Category } from "../../lib/types";

const TOKEN_SPLIT = /(\[(?:PII|PHI|PFI)_[A-Z]+_\d+\])/g;

/** Render a string, turning any token substring into a glass chip. */
function withChips(text: string): ReactNode[] {
  return text.split(TOKEN_SPLIT).map((part, i) => {
    const m = /^\[(PII|PHI|PFI)_/.exec(part);
    if (m) return <TokenChip key={i} token={part} category={m[1] as Category} size="sm" className="mx-0.5" />;
    return (
      <span key={i} className="text-mercury/55">
        {part}
      </span>
    );
  });
}

const DETECTED = [
  { raw: "Prachan Mehta", cat: "PII" as Category, sub: "person" },
  { raw: "002233445566", cat: "PFI" as Category, sub: "account" },
  { raw: "₹84,500", cat: "PFI" as Category, sub: "amount" },
  { raw: "diabetes", cat: "PHI" as Category, sub: "condition" },
];

const MASKED_LINE = "Prachan Mehta → [PII_PERSON_1] · 002233445566 → [PFI_ACCOUNT_1] · ₹84,500 → [PFI_AMOUNT_1] · diabetes → [PHI_CONDITION_1]";
const REASON_LINE = "Customer [PII_PERSON_1] holds [PFI_ACCOUNT_1]. The [PFI_AMOUNT_1] order is consistent with prior activity; [PHI_CONDITION_1] care is noted. No anomaly detected.";
const RESTORED_LINE = "Customer Prachan Mehta holds ICICI account 002233445566. The ₹84,500 order is consistent with prior activity; diabetes care is noted. No anomaly detected.";

const STAGES: { title: string; caption: string; body: ReactNode }[] = [
  {
    title: "Detect",
    caption: "Format rules catch PAN, Aadhaar, IFSC, accounts and amounts; NER catches names and conditions.",
    body: (
      <div className="flex flex-wrap items-center gap-2.5">
        {DETECTED.map((d) => (
          <span
            key={d.raw}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[13px]"
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
    caption: "Each value becomes a stable token. Same value, same token — so relationships survive.",
    body: <p className="flex flex-wrap items-center gap-y-2 font-mono text-[13px] leading-loose">{withChips(MASKED_LINE)}</p>,
  },
  {
    title: "Reason",
    caption: "Only placeholders leave your environment. The model reasons over tokens, never raw values.",
    body: <p className="flex flex-wrap items-center gap-y-2 font-mono text-[13px] leading-loose">{withChips(REASON_LINE)}</p>,
  },
  {
    title: "Unmask",
    caption: "Tokens are swapped back from the encrypted vault — the finished answer, for you alone.",
    body: <p className="text-[15px] leading-relaxed text-mercury-bright">{RESTORED_LINE}</p>,
  },
];

function StagePanel({ children }: { children: ReactNode }) {
  return (
    <GlassPanel className="glass-strong w-full max-w-2xl px-7 py-9 sm:px-10 sm:py-11" specular>
      {children}
    </GlassPanel>
  );
}

function StageHeader({ index, title, caption }: { index: number; title: string; caption: string }) {
  return (
    <>
      <div className="mb-5 flex items-baseline gap-4">
        <span className="font-mono text-sm text-mercury-deep">0{index + 1}</span>
        <h3 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] font-semibold tracking-[-0.02em] text-mercury-bright">
          {title}
        </h3>
      </div>
      <p className="mb-7 max-w-md text-[15px] leading-relaxed text-mercury/70">{caption}</p>
    </>
  );
}

/** A single fly-through layer. Far -> centred -> receding, blurring at the edges of its window. */
function FlyStage({ progress, index, children }: { progress: MotionValue<number>; index: number; children: ReactNode }) {
  const c = index / (STAGES.length - 1);
  const opacity = useTransform(progress, [c - 0.17, c - 0.05, c + 0.05, c + 0.17], [0, 1, 1, 0]);
  const scale = useTransform(progress, [c - 0.17, c, c + 0.17], [1.32, 1, 0.72]);
  const y = useTransform(progress, [c - 0.17, c, c + 0.17], [70, 0, -56]);
  const blur = useTransform(progress, [c - 0.17, c - 0.04, c + 0.04, c + 0.17], ["blur(14px)", "blur(0px)", "blur(0px)", "blur(14px)"]);
  return (
    <motion.div style={{ opacity, scale, y, filter: blur }} className="absolute inset-0 flex items-center justify-center px-6">
      {children}
    </motion.div>
  );
}

function Rail({ progress, active }: { progress: MotionValue<number>; active: number }) {
  const len = useSpring(progress, { stiffness: 120, damping: 30 });
  return (
    <div className="relative hidden h-[60vh] w-44 shrink-0 lg:block">
      <svg viewBox="0 0 24 400" preserveAspectRatio="none" className="absolute left-0 top-0 h-full w-6">
        <line x1="12" y1="6" x2="12" y2="394" stroke="rgba(140,151,171,0.18)" strokeWidth="1.5" />
        <motion.line
          x1="12"
          y1="6"
          x2="12"
          y2="394"
          stroke="rgba(234,240,248,0.7)"
          strokeWidth="1.5"
          style={{ pathLength: len }}
        />
      </svg>
      {STAGES.map((s, i) => (
        <div key={s.title} className="absolute left-8 flex items-center gap-3" style={{ top: `calc(${(i / (STAGES.length - 1)) * 100}% - 8px)` }}>
          <span
            className="h-2.5 w-2.5 rounded-full transition-all duration-300"
            style={{
              background: i <= active ? "#EAF0F8" : "rgba(140,151,171,0.3)",
              boxShadow: i === active ? "0 0 12px 2px rgba(234,240,248,0.6)" : "none",
            }}
          />
          <span className={`font-mono text-[12px] tracking-wide transition-colors duration-300 ${i === active ? "text-mercury-bright" : "text-mercury-deep"}`}>
            {s.title}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Pipeline() {
  const { reduced } = useMotionPref();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(STAGES.length - 1, Math.max(0, Math.round(v * (STAGES.length - 1))));
    setActive((prev) => {
      if (next !== prev) playSeal();
      return next;
    });
  });

  if (reduced) {
    // Accessible fallback: a calm stacked sequence, no scrubbing or fly-through.
    return (
      <section id="pipeline" className="mx-auto max-w-3xl px-6 py-28">
        <SectionLabel>The pipeline</SectionLabel>
        <h2 className="mb-12 mt-5 font-display text-[clamp(2rem,5vw,3.2rem)] font-semibold tracking-[-0.025em] text-mercury-bright">
          Detect. Mask. Reason. Unmask.
        </h2>
        <div className="flex flex-col gap-6">
          {STAGES.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
              <StagePanel>
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
    <section id="pipeline" ref={sectionRef} className="relative" style={{ height: "420vh" }}>
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-8 px-6">
          <Rail progress={scrollYProgress} active={active} />
          <div className="relative h-[64vh] flex-1" style={{ perspective: 1400 }}>
            {STAGES.map((s, i) => (
              <FlyStage key={s.title} progress={scrollYProgress} index={i}>
                <StagePanel>
                  <StageHeader index={i} title={s.title} caption={s.caption} />
                  {s.body}
                </StagePanel>
              </FlyStage>
            ))}
          </div>
        </div>
        <div className="absolute left-6 top-10 z-[5] sm:left-10">
          <SectionLabel>The pipeline</SectionLabel>
        </div>
      </div>
    </section>
  );
}
