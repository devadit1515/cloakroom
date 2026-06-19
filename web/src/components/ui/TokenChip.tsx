import { motion, type HTMLMotionProps } from "framer-motion";
import { CATEGORY_META, type Category } from "../../lib/types";

type Props = HTMLMotionProps<"span"> & {
  token: string;
  category: Category;
  /** Render the human category word (Identity / Health / Financial) alongside. */
  showCategory?: boolean;
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: "px-2.5 py-1 text-[12px]",
  md: "px-3 py-1.5 text-[13px]",
  lg: "px-4 py-2 text-[15px]",
};

/** A frosted-glass token chip that catches light. Category is conveyed by both colour AND
 *  text (never colour alone), so meaning survives colour-blindness and reduced-contrast modes. */
export function TokenChip({ token, category, showCategory = false, size = "md", className = "", ...rest }: Props) {
  const meta = CATEGORY_META[category];
  return (
    <motion.span
      className={`relative inline-flex select-none items-center gap-1.5 rounded-full font-mono ${SIZES[size]} ${className}`}
      style={{
        color: meta.hex,
        background: "rgba(202,212,228,0.05)",
        border: `1px solid ${meta.hex}40`,
        boxShadow: `0 0 0 1px rgba(234,240,248,0.04) inset, 0 8px 22px -12px ${meta.hex}66, 0 0 18px -6px ${meta.hex}55`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
      {...rest}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: meta.hex, boxShadow: `0 0 8px 1px ${meta.hex}` }} />
      <span>{token}</span>
      {showCategory && (
        <span className="ml-1 text-[10px] uppercase tracking-[0.18em] opacity-60">{meta.full}</span>
      )}
    </motion.span>
  );
}
