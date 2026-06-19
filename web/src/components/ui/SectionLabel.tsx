import type { ReactNode } from "react";

/** A restrained section marker: a short rule + small-caps label. Used deliberately on a
 *  couple of sections for orientation — not as an eyebrow above every heading. */
export function SectionLabel({ children, align = "left" }: { children: ReactNode; align?: "left" | "center" }) {
  return (
    <div className={`flex items-center gap-3 ${align === "center" ? "justify-center" : ""}`}>
      <span aria-hidden className="h-px w-8 bg-mercury/30" />
      <span className="label text-mercury-deep">{children}</span>
    </div>
  );
}
