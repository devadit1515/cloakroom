import { motion, type Variants } from "framer-motion";
import { GlassPanel } from "../ui/GlassPanel";
import { SectionLabel } from "../ui/SectionLabel";

const reveal: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 22 } },
};
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

/** A swappable adapter column inside the cloud-agnostic diagram. No bordered sub-cards (no nesting) —
 *  just a labelled stack separated by air and a connector. */
function AdapterColumn({ role, options }: { role: string; options: string[] }) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <span className="label text-mercury-deep">{role}</span>
      {options.map((o, i) => (
        <span
          key={o}
          className="font-mono text-[13px]"
          style={{ color: i === 0 ? "#EAF0F8" : "rgba(140,151,171,0.7)" }}
        >
          {o}
          {i === 0 && <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-mercury-deep">active</span>}
        </span>
      ))}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-28">
      <SectionLabel>Under the glass</SectionLabel>
      <h2 className="mb-12 mt-5 max-w-2xl text-balance font-display text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.025em] text-mercury-bright">
        The same orchestration, on any cloud.
      </h2>

      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        {/* large — cloud-agnostic diagram */}
        <motion.div variants={reveal} className="md:col-span-2 md:row-span-2">
          <GlassPanel className="flex h-full flex-col px-7 py-8" specular>
            <h3 className="font-display text-[1.6rem] font-semibold tracking-[-0.02em] text-mercury-bright">
              Cloud-agnostic by design
            </h3>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-mercury/70">
              Detection, vault, and model each sit behind one interface. The detect → mask → reason →
              unmask logic never changes — only the thin adapter underneath does.
            </p>
            <div className="mt-8 flex items-start gap-5">
              <AdapterColumn role="Detect" options={["Presidio", "AWS Comprehend", "Azure AI", "GCP DLP"]} />
              <span aria-hidden className="mt-7 h-px flex-1 self-start bg-gradient-to-r from-mercury/30 to-transparent" />
              <AdapterColumn role="Vault" options={["Redis", "Postgres", "Secrets Mgr", "Key Vault"]} />
              <span aria-hidden className="mt-7 h-px flex-1 self-start bg-gradient-to-r from-mercury/30 to-transparent" />
              <AdapterColumn role="Model" options={["Local / Ollama", "Anthropic", "OpenAI", "Bedrock"]} />
            </div>
          </GlassPanel>
        </motion.div>

        {/* encrypted vault */}
        <motion.div variants={reveal}>
          <GlassPanel className="flex h-full flex-col justify-between px-6 py-7" specular>
            <h3 className="font-display text-[1.3rem] font-semibold tracking-[-0.02em] text-mercury-bright">
              Encrypted vault
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-mercury/70">
              Token → value pairs are Fernet-encrypted, scoped to the session, and expire on a TTL.
            </p>
            <p className="mt-5 font-mono text-[12px] text-mercury-deep">AES-128 · session-scoped · auto-expiry</p>
          </GlassPanel>
        </motion.div>

        {/* session-consistent tokens */}
        <motion.div variants={reveal}>
          <GlassPanel className="flex h-full flex-col justify-between px-6 py-7" specular>
            <h3 className="font-display text-[1.3rem] font-semibold tracking-[-0.02em] text-mercury-bright">
              Stable tokens
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-mercury/70">
              The same value always maps to the same token within a session — so the model can reason
              about relationships across turns.
            </p>
            <p className="mt-5 font-mono text-[12px] text-mercury-deep">Prachan → [PII_PERSON_1] · always</p>
          </GlassPanel>
        </motion.div>

        {/* value-free audit log — full-width strip */}
        <motion.div variants={reveal} className="md:col-span-3">
          <GlassPanel className="flex flex-col gap-3 px-6 py-6 md:flex-row md:items-center md:justify-between" specular={false}>
            <div>
              <h3 className="font-display text-[1.3rem] font-semibold tracking-[-0.02em] text-mercury-bright">
                Value-free audit log
              </h3>
              <p className="mt-1 text-[14px] text-mercury/70">
                Prove compliance without ever copying the data you are protecting.
              </p>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-white/10 bg-obsidian-900/60 px-4 py-3 font-mono text-[12px] text-mercury/70">
{`{ "session": "a91…", "detected": { "PII": 1, "PFI": 2, "PHI": 1 }, "latency_ms": 42 }`}
              <span className="ml-2 text-mercury-deep">{`// no raw values, ever`}</span>
            </pre>
          </GlassPanel>
        </motion.div>
      </motion.div>
    </section>
  );
}
