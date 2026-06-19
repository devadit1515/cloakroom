import type { ReactNode } from "react";
import { motion } from "framer-motion";

type Variant = "primary" | "ghost";

interface Props {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}

/** Mercury glass button. Primary catches the key light; ghost is a quiet glass outline.
 *  Spring micro-interactions on hover/tap. */
export function MercuryButton({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  disabled,
}: Props) {
  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-medium tracking-tight disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2";

  const skin =
    variant === "primary"
      ? "text-obsidian-900"
      : "glass text-mercury-bright";

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${skin} ${className}`}
      style={
        variant === "primary"
          ? {
              background: "linear-gradient(180deg, #EEF2F8, #D3DCEA)",
              boxShadow:
                "0 1px 0 0 rgba(255,255,255,0.65) inset, 0 14px 34px -18px rgba(200,210,224,0.5), 0 2px 8px -3px rgba(0,0,0,0.45)",
            }
          : undefined
      }
      whileHover={{ scale: 1.035, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 24 }}
    >
      {variant === "primary" && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.65) 50%, transparent 75%)",
          }}
          initial={{ x: "-130%" }}
          whileHover={{ x: "130%" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      <span className="relative z-[1] inline-flex items-center gap-2">{children}</span>
    </motion.button>
  );
}
