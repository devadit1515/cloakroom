import { useRef, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, type HTMLMotionProps } from "framer-motion";

type Props = HTMLMotionProps<"div"> & {
  children: ReactNode;
  /** Show a soft specular highlight that tracks the cursor across the glass. */
  specular?: boolean;
  /** Show the faint iridescent top-edge line. Turn off for panels where it reads as a stray white line. */
  edge?: boolean;
  className?: string;
};

/** A ~6mm-thick liquid-glass surface: translucent fill, light-catching top edge,
 *  ambient-occlusion drop shadow, and an optional cursor-tracked specular sheen. */
export function GlassPanel({ children, specular = true, edge = true, className = "", ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(50);
  const my = useMotionValue(0);
  const sheen = useMotionTemplate`radial-gradient(420px circle at ${mx}% ${my}%, rgba(234,240,248,0.10), transparent 60%)`;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!specular || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 100);
    my.set(((e.clientY - r.top) / r.height) * 100);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      className={`group glass relative overflow-hidden rounded-[20px] ${className}`}
      {...rest}
    >
      {specular && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: sheen }}
        />
      )}
      {/* faint iridescent top edge */}
      {edge && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(177,151,214,0.35), rgba(234,240,248,0.5), rgba(220,184,126,0.3), transparent)",
          }}
        />
      )}
      <div className="relative z-[1]">{children}</div>
    </motion.div>
  );
}
