import { useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { MercuryButton } from "../ui/MercuryButton";
import { decide, applyDecisions, unmask, type CloakResult } from "../../lib/cloak";

function colorFor(type: string): string {
  if (type.startsWith("PHI")) return "#5FB3A8";
  if (type.startsWith("PFI")) return "#DCB87E";
  if (type.startsWith("PII")) return "#B197D6";
  return "#C8D2E0";
}

function Chip({ label, hex }: { label: string; hex: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 font-mono text-[12px]"
      style={{ color: hex, border: `1px solid ${hex}45`, background: "rgba(202,212,228,0.03)" }}
    >
      {label}
    </span>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1300);
      }}
      className="rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[12px] text-mercury/75 transition-colors hover:border-white/25 hover:text-mercury-bright focus-visible:outline-2"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

const ta =
  "w-full resize-y rounded-xl border border-white/10 bg-obsidian-900/60 px-4 py-3 font-mono text-[13px] leading-relaxed text-mercury-bright outline-none focus-visible:border-mercury/40";

export function CloakTool() {
  const [prompt, setPrompt] = useState("Summarize this customer complaint and suggest next steps.");
  const [data, setData] = useState(
    "Aarav Sharma (PAN ABCDE1234F) is furious about a wrong ₹84,500 charge on account 002233445566. Reach him at aarav@example.com. He also mentioned his diabetes meds were delayed."
  );
  const [result, setResult] = useState<CloakResult | null>(null);
  const [reply, setReply] = useState("");
  const [restored, setRestored] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function cloak() {
    setError("");
    setRestored(null);
    if (!data.trim()) return setError("Paste some data first.");
    setLoading(true);
    try {
      const items = await decide(data, prompt);
      setResult(applyDecisions(data, items));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const bundle = result ? `${prompt.trim()}\n\n${result.maskedText}` : "";

  return (
    <main className="relative z-[10] mx-auto min-h-[100svh] max-w-3xl px-6 py-16">
      <a href="/" className="font-mono text-[13px] text-mercury/60 hover:text-mercury-bright">
        ← Cloakroom
      </a>

      <header className="mt-6">
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] font-semibold tracking-[-0.025em] text-mercury-bright">
          Prompt-aware cloak
        </h1>
        <p className="mt-3 max-w-xl text-pretty leading-relaxed text-mercury/70">
          Paste your data and what you want done. Gemini decides what to hide and what to keep for
          the task. Copy the masked text into any LLM, then paste its reply back to restore the real
          values — locally.
        </p>
      </header>

      <p className="mt-6 font-mono text-[11px] text-mercury/45">
        The mask/keep decision runs on a hosted open model (Groq · Llama) — no key needed here. Your
        data is analyzed there to decide masking; the masked text is what you paste into your main
        LLM, and the token map stays in this browser.
      </p>

      {/* 1 — input */}
      <GlassPanel className="mt-8 flex flex-col gap-4 p-5 sm:p-6" specular={false}>
        <span className="label text-mercury-deep/90">1 · Your request</span>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What do you want the LLM to do?"
          className="w-full rounded-xl border border-white/10 bg-obsidian-900/60 px-4 py-3 text-[14px] text-mercury-bright outline-none focus-visible:border-mercury/40"
        />
        <textarea value={data} onChange={(e) => setData(e.target.value)} rows={6} spellCheck={false} className={ta} placeholder="Paste your data…" />
        <div className="flex items-center justify-between gap-4">
          {error ? <span className="font-mono text-[12px] text-[#DCB87E]">{error}</span> : <span />}
          <MercuryButton onClick={cloak} disabled={loading}>
            {loading ? "Cloaking…" : "Cloak with AI"}
          </MercuryButton>
        </div>
      </GlassPanel>

      {/* 2 — masked output */}
      {result && (
        <GlassPanel className="mt-6 flex flex-col gap-4 p-5 sm:p-6" specular={false}>
          <div className="flex items-center justify-between">
            <span className="label text-mercury-deep/90">2 · Send this to your LLM</span>
            <CopyButton text={bundle} label="Copy prompt + masked" />
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-obsidian-900/60 px-4 py-3 font-mono text-[13px] leading-relaxed text-mercury/85">
            {bundle}
          </pre>
          {result.masked.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mercury-deep">masked</span>
              <div className="flex flex-wrap gap-2">
                {result.masked.map((m) => (
                  <Chip key={m.token} label={`${m.token}`} hex={colorFor(m.type)} />
                ))}
              </div>
            </div>
          )}
          {result.kept.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mercury-deep">kept visible (needed for the task)</span>
              <div className="flex flex-col gap-1">
                {result.kept.map((k, i) => (
                  <span key={i} className="font-mono text-[12px] text-mercury/65">
                    <span className="text-mercury-bright">{k.value}</span> — {k.reason}
                  </span>
                ))}
              </div>
            </div>
          )}
          {result.masked.length === 0 && <span className="font-mono text-[12px] text-mercury/55">Nothing was masked for this task.</span>}
        </GlassPanel>
      )}

      {/* 3 — decrypt */}
      {result && (
        <GlassPanel className="mt-6 flex flex-col gap-4 p-5 sm:p-6" specular={false}>
          <span className="label text-mercury-deep/90">3 · Decrypt the reply</span>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={5} spellCheck={false} className={ta} placeholder="Paste the LLM's reply (with tokens) here…" />
          <div className="flex items-center justify-end">
            <MercuryButton onClick={() => setRestored(unmask(reply, result.map))} disabled={!reply.trim()}>
              Uncloak reply
            </MercuryButton>
          </div>
          {restored !== null && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mercury-deep">restored</span>
                <CopyButton text={restored} />
              </div>
              <p className="whitespace-pre-wrap rounded-xl border border-white/10 bg-obsidian-900/60 px-4 py-3 text-[14px] leading-relaxed text-mercury-bright">
                {restored}
              </p>
            </div>
          )}
        </GlassPanel>
      )}
    </main>
  );
}
