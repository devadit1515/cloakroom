import { useEffect } from "react";
import { MotionConfig, motion } from "framer-motion";
import { MotionPrefProvider } from "./components/ui/MotionToggle";
import { useLenis, scrollToId } from "./hooks/useLenis";
import { setSoundEnabled } from "./lib/sound";
import { Grain } from "./components/ui/Grain";
import { Hero } from "./components/hero/Hero";
import { Pipeline } from "./components/pipeline/Pipeline";
import { Playground } from "./components/playground/Playground";
import { HowItWorks } from "./components/how/HowItWorks";
import { SealFooter } from "./components/footer/SealFooter";

function Wordmark() {
  return (
    <motion.button
      type="button"
      onClick={() => scrollToId("vault")}
      className="fixed left-4 top-4 z-[40] font-display text-[17px] font-semibold tracking-[-0.01em] text-mercury-bright/90 hover:text-mercury-bright focus-visible:outline-2 sm:left-6 sm:top-6"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 24 }}
    >
      Cloakroom
    </motion.button>
  );
}

function AppShell() {
  useLenis(true);
  // Motion and sound are permanently on in this build.
  useEffect(() => setSoundEnabled(true), []);

  return (
    <MotionConfig reducedMotion="never" transition={{ type: "spring", stiffness: 200, damping: 26 }}>
      <Grain />
      <Wordmark />
      <main className="relative z-[10]">
        <Hero />
        <Pipeline />
        <Playground />
        <HowItWorks />
        <SealFooter />
      </main>
    </MotionConfig>
  );
}

export default function App() {
  return (
    <MotionPrefProvider>
      <AppShell />
    </MotionPrefProvider>
  );
}
