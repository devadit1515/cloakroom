import { useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

// Rough per-line / padding estimates (px) used only for the min-height floor.
const LINE = 22;
const PAD = 26;

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  /** Minimum visible height, in text rows, when the content is shorter. */
  minRows?: number;
};

/** A textarea that grows to fit its content — the whole value is always visible with
 *  no inner scrollbar, down to a `minRows` floor. Recomputes on value + viewport changes. */
export function AutoTextarea({ value, minRows = 4, style, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(fit, [value]);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <textarea
      ref={ref}
      value={value}
      style={{ minHeight: minRows * LINE + PAD, overflow: "hidden", resize: "none", ...style }}
      {...rest}
    />
  );
}
