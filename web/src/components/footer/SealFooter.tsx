import { useEffect } from "react";
import { motion, useAnimate, useInView } from "framer-motion";
import { useMotionPref } from "../ui/MotionToggle";

const MARKS = ["HIPAA", "PCI-DSS", "GDPR", "DPDP"];

/** The close: two vault-door halves slide together and seal with a seam of light.
 *  Choreographed with useAnimate; reduced motion ships the door already sealed. */
export function SealFooter() {
  const { reduced } = useMotionPref();
  const [scope, animate] = useAnimate();
  const inView = useInView(scope, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      animate(".door-l", { x: "0%" }, { duration: 0 });
      animate(".door-r", { x: "0%" }, { duration: 0 });
      return;
    }
    const seq = async () => {
      await animate(
        [
          [".door-l", { x: "0%" }, { type: "spring", stiffness: 70, damping: 18 }],
          [".door-r", { x: "0%" }, { type: "spring", stiffness: 70, damping: 18, at: "<" }],
          [".seal-copy", { opacity: [0, 1], y: [12, 0] }, { duration: 0.6, at: "-0.3" }],
        ]
      );
    };
    void seq();
  }, [inView, reduced, animate]);

  return (
    <footer ref={scope} id="seal" className="relative mx-auto max-w-6xl px-6 pb-16 pt-24">
      {/* the door */}
      <div className="relative mx-auto h-[210px] w-full max-w-3xl overflow-hidden rounded-[24px]">
        <motion.div
          className="door-l glass absolute inset-y-0 left-0 w-1/2 rounded-l-[24px]"
          initial={{ x: "-104%" }}
          style={{ borderRight: "none" }}
        />
        <motion.div
          className="door-r glass absolute inset-y-0 right-0 w-1/2 rounded-r-[24px]"
          initial={{ x: "104%" }}
          style={{ borderLeft: "none" }}
        />
        {/* engraved closing line on the sealed door */}
        <div className="seal-copy absolute inset-0 flex flex-col items-center justify-center text-center" style={{ opacity: reduced ? 1 : 0 }}>
          <p className="font-display text-[clamp(1.4rem,3.4vw,2.1rem)] font-medium tracking-[-0.02em] text-mercury-bright">
            Your data never left the room.
          </p>
          <p className="mt-2 font-mono text-[12px] text-mercury/55">detect · mask · reason · unmask</p>
        </div>
      </div>

      {/* compliance marks + colophon */}
      <div className="mt-12 flex flex-col items-center gap-6">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {MARKS.map((m, i) => (
            <span key={m} className="flex items-center gap-3">
              {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-mercury/30" />}
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-mercury-deep">{m}</span>
            </span>
          ))}
        </div>
        <div className="flex w-full flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 sm:flex-row">
          <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-mercury">Cloakroom</span>
          <span className="font-mono text-[11px] text-mercury/45">Cloud-agnostic PII · PHI · PFI masking · zero paid keys</span>
        </div>
      </div>
    </footer>
  );
}
