import { createContext, useContext, type ReactNode } from "react";

interface MotionPrefCtx {
  /** Always false in this build — motion is permanently on (toggle removed by request). */
  reduced: boolean;
}

const Ctx = createContext<MotionPrefCtx>({ reduced: false });

export function MotionPrefProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={{ reduced: false }}>{children}</Ctx.Provider>;
}

export function useMotionPref(): MotionPrefCtx {
  return useContext(Ctx);
}
