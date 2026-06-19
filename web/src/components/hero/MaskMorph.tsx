import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TokenChip } from "../ui/TokenChip";
import { useMotionPref } from "../ui/MotionToggle";
import type { Category } from "../../lib/types";

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%$@&*?".split("");

/** Scrambles `text` into place over ~420ms whenever `trigger` changes. Honors reduced motion. */
function useScramble(text: string, trigger: number, reduced: boolean): string {
  const [out, setOut] = useState(text);
  const raf = useRef(0);
  useEffect(() => {
    if (reduced) {
      setOut(text);
      return;
    }
    let start = 0;
    const dur = 420;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const reveal = Math.floor(p * text.length);
      let s = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (i < reveal || ch === " ") s += ch;
        else s += GLYPHS[(Math.floor(t / 28) + i * 7) % GLYPHS.length];
      }
      setOut(s);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else setOut(text);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, reduced]);
  return out;
}

interface Props {
  raw: string;
  token: string;
  category: Category;
  masked: boolean;
  size?: "sm" | "md" | "lg";
}

/** The signature transition: a real value physically dematerializes into a glass token and back.
 *  Shared `layoutId` morphs position/size between the two; blur+scale exit/enter does the dissolve;
 *  the value scrambles as it re-materializes. */
export function MaskMorph({ raw, token, category, masked, size = "md" }: Props) {
  const { reduced } = useMotionPref();
  const [appearCount, setAppearCount] = useState(0);
  useEffect(() => {
    if (!masked) setAppearCount((c) => c + 1);
  }, [masked]);
  const display = useScramble(raw, appearCount, reduced);

  const spring = { type: "spring" as const, stiffness: 220, damping: 26, mass: 0.7 };
  const dissolve = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.55, filter: "blur(12px)" },
        animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, scale: 0.55, filter: "blur(12px)" },
      };

  return (
    <span className="relative mx-1 inline-flex align-baseline">
      <AnimatePresence mode="popLayout" initial={false}>
        {masked ? (
          <motion.span
            key="token"
            layoutId={token}
            {...dissolve}
            transition={spring}
            className="inline-flex"
          >
            <TokenChip token={token} category={category} size={size} />
          </motion.span>
        ) : (
          <motion.span
            key="raw"
            layoutId={token}
            {...dissolve}
            transition={spring}
            className="inline-flex whitespace-nowrap rounded-full border border-white/5 bg-white/[0.02] px-2.5 py-1 font-mono text-mercury-bright tabular"
            style={{ fontSize: size === "lg" ? 15 : size === "sm" ? 12 : 13 }}
          >
            {display}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
