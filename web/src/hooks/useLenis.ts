import { useEffect } from "react";
import Lenis from "lenis";

let lenisInstance: Lenis | null = null;

/** The live Lenis instance, or null when smooth scroll is off (reduced motion).
 *  Lets components animate real scroll position (e.g. the pipeline autoplay). */
export function getLenis(): Lenis | null {
  return lenisInstance;
}

/** Smoothly scroll to an element id (used by the "Try it" CTA and footer links). */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenisInstance) lenisInstance.scrollTo(el, { offset: 0, duration: 1.4 });
  else el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Initialise Lenis smooth scroll. Disabled when the user prefers reduced motion
 *  (native scrolling stays crisp and instant). Lenis drives real scroll position,
 *  so Framer Motion's useScroll continues to work unchanged. */
export function useLenis(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      lenisInstance?.destroy();
      lenisInstance = null;
      return;
    }
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      wheelMultiplier: 0.9,
      touchMultiplier: 1.2,
    });
    lenisInstance = lenis;

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisInstance = null;
    };
  }, [enabled]);
}
