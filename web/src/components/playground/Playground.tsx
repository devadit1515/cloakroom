import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { GlassPanel } from "../ui/GlassPanel";
import { MercuryButton } from "../ui/MercuryButton";
import { SectionLabel } from "../ui/SectionLabel";
import { TokenChip } from "../ui/TokenChip";
import { processPayload } from "../../lib/api";
import { PLAYGROUND_DEFAULT, PLAYGROUND_INSTRUCTION } from "../../lib/sample";
import {
  CATEGORY_META,
  STRATEGY_OPTIONS,
  type Category,
  type MaskStrategyName,
  type ProcessResponse,
} from "../../lib/types";

const TOKEN_SPLIT = /(\[(?:PII|PHI|PFI)_[A-Z]+_\d+\])/g;
const CATEGORIES: Category[] = ["PII", "PHI", "PFI"];

const chipStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const chipItem: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 22 } },
};

/** Masked payload with draggable token chips (drag is a delightful easter egg — chips snap back). */
function MaskedBody({ text, dragRef }: { text: string; dragRef: React.RefObject<HTMLDivElement> }) {
  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-mercury/55">
      {text.split(TOKEN_SPLIT).map((part, i) => {
        const m = /^\[(PII|PHI|PFI)_/.exec(part);
        if (!m) return <span key={i}>{part}</span>;
        return (
          <TokenChip
            key={i}
            token={part}
            category={m[1] as Category}
            size="sm"
            className="mx-1.5 my-0.5 cursor-grab active:cursor-grabbing"
            drag
            dragConstraints={dragRef}
            dragElastic={0.35}
            dragSnapToOrigin
            whileDrag={{ scale: 1.18, zIndex: 5 }}
            whileHover={{ scale: 1.06 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
          />
        );
      })}
    </pre>
  );
}

function ResultCard({
  label,
  caption,
  children,
  innerRef,
}: {
  label: string;
  caption?: ReactNode;
  children: ReactNode;
  innerRef?: React.RefObject<HTMLDivElement>;
}) {
  return (
    <GlassPanel className="flex h-full flex-col px-5 py-5" specular>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="label text-mercury-deep/90">{label}</span>
        {caption}
      </div>
      <div ref={innerRef} className="relative max-h-72 flex-1 overflow-auto pr-1">
        {children}
      </div>
    </GlassPanel>
  );
}

export function Playground() {
  const [input, setInput] = useState(PLAYGROUND_DEFAULT);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState<MaskStrategyName>("token");
  const sessionId = useRef("web-" + Math.random().toString(36).slice(2, 10)).current;
  const maskedRef = useRef<HTMLDivElement>(null);

  async function run(strat: MaskStrategyName = strategy) {
    setLoading(true);
    const r = await processPayload(input, {
      instruction: PLAYGROUND_INSTRUCTION,
      sessionId: sessionId + "-" + strat, // fresh session per strategy so tokens don't clash
      context: "customer record",
      strategy: strat,
    });
    setResult(r);
    setLoading(false);
  }

  const pickStrategy = (strat: MaskStrategyName) => {
    setStrategy(strat);
    void run(strat);
  };

  // run once on mount so the proof is already on screen
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = (cat: Category) => {
    if (!result) return { total: 0, subs: [] as { sub: string; n: number }[] };
    const subs: { sub: string; n: number }[] = [];
    let total = 0;
    for (const [k, n] of Object.entries(result.detected_counts)) {
      const [c, sub] = k.split(":");
      if (c === cat) {
        subs.push({ sub, n });
        total += n;
      }
    }
    return { total, subs };
  };

  return (
    <section id="playground" className="mx-auto max-w-6xl px-6 py-28">
      <SectionLabel>The proof</SectionLabel>
      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="max-w-2xl text-balance font-display text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.025em] text-mercury-bright">
          Paste a record. Watch it leave nothing behind.
        </h2>
        <p className="max-w-sm text-[15px] leading-relaxed text-mercury/65">
          The middle card is exactly what the model receives — tokens only. Try editing the record, or
          drag a token loose.
        </p>
      </div>

      {/* input */}
      <div className="mt-10">
        <GlassPanel className="p-5 sm:p-6" specular={false}>
          <label htmlFor="record" className="label mb-3 block text-mercury-deep/90">
            input — text or JSON
          </label>
          <textarea
            id="record"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            rows={8}
            className="w-full resize-y rounded-xl border border-white/10 bg-obsidian-900/60 px-4 py-3 font-mono text-[13px] leading-relaxed text-mercury-bright outline-none focus-visible:border-mercury/40"
          />

          {/* masking strategy — how each value is replaced */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="label mr-1 text-mercury-deep/90">strategy</span>
            {STRATEGY_OPTIONS.map((o) => {
              const active = o.key === strategy;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => pickStrategy(o.key)}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1.5 font-mono text-[12px] transition-colors focus-visible:outline-2 ${
                    active ? "bg-mercury text-obsidian-900" : "glass text-mercury/70 hover:text-mercury-bright"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
            <span className="ml-1 font-mono text-[11px] text-mercury/45">
              {STRATEGY_OPTIONS.find((o) => o.key === strategy)?.hint}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-[12px] text-mercury/55">
              instruction to the model: <span className="text-mercury/80">{PLAYGROUND_INSTRUCTION}</span>
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setInput(PLAYGROUND_DEFAULT)}
                className="rounded-full border border-white/12 bg-white/[0.03] px-4 py-2.5 font-mono text-[12px] text-mercury/75 transition-colors hover:border-white/25 hover:text-mercury-bright focus-visible:outline-2"
              >
                reset sample
              </button>
              <MercuryButton onClick={() => run()} disabled={loading}>
                {loading ? "Cloaking…" : "Cloak it"}
              </MercuryButton>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* three synced cards */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.source + result.masked_payload.length}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 160, damping: 24 }}
            className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3"
          >
            <ResultCard label="you sent">
              <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-mercury/70">
                {input}
              </pre>
            </ResultCard>

            <ResultCard
              label="the model saw"
              caption={<span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mercury-deep">tokens only</span>}
              innerRef={maskedRef}
            >
              <MaskedBody text={result.masked_payload} dragRef={maskedRef} />
            </ResultCard>

            <ResultCard
              label="you get back"
              caption={
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{
                    color: result.source === "live" ? "#5FB3A8" : "#DCB87E",
                    border: `1px solid ${result.source === "live" ? "#5FB3A8" : "#DCB87E"}55`,
                  }}
                >
                  {result.source === "live" ? "live api" : "mock"}
                </span>
              }
            >
              <p className="text-[14px] leading-relaxed text-mercury-bright">{result.output}</p>
            </ResultCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* detected counts + leak scan */}
      {result && (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <motion.div
            variants={chipStagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="md:col-span-2"
          >
            <GlassPanel className="flex h-full flex-wrap items-center gap-4 px-5 py-5" specular={false}>
              <span className="label mr-1 text-mercury-deep/90">detected</span>
              {CATEGORIES.map((cat) => {
                const { total, subs } = grouped(cat);
                const meta = CATEGORY_META[cat];
                if (total === 0) return null;
                return (
                  <motion.span
                    key={cat}
                    variants={chipItem}
                    className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px]"
                    style={{ color: meta.hex, border: `1px solid ${meta.hex}45`, background: "rgba(202,212,228,0.03)" }}
                  >
                    <span className="font-medium">{meta.full}</span>
                    <span className="tabular font-mono text-mercury-bright">{total}</span>
                    <span className="text-[10px] uppercase tracking-[0.14em] opacity-55">
                      {subs.map((s) => s.sub).join(" · ")}
                    </span>
                  </motion.span>
                );
              })}
              {Object.keys(result.detected_counts).length === 0 && (
                <span className="font-mono text-[13px] text-mercury/55">no sensitive entities found</span>
              )}
            </GlassPanel>
          </motion.div>

          <GlassPanel className="flex h-full items-center gap-3 px-5 py-5" specular={false}>
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px]"
              style={
                result.flagged_leaks.length === 0
                  ? { color: "#5FB3A8", border: "1px solid #5FB3A855" }
                  : { color: "#DCB87E", border: "1px solid #DCB87E55" }
              }
            >
              {result.flagged_leaks.length === 0 ? "✓" : "!"}
            </span>
            <div>
              <p className="text-[13px] text-mercury-bright">
                {result.flagged_leaks.length === 0
                  ? "Output verified clean"
                  : `${result.flagged_leaks.length} leak${result.flagged_leaks.length > 1 ? "s" : ""} flagged`}
              </p>
              <p className="font-mono text-[11px] text-mercury/55">secondary scan of the model output</p>
            </div>
          </GlassPanel>
        </div>
      )}
    </section>
  );
}
