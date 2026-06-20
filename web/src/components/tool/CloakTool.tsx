import { useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { MercuryButton } from "../ui/MercuryButton";
import { AutoTextarea } from "../ui/AutoTextarea";
import { smartMask, unmask, type CloakResult } from "../../lib/cloak";

function colorFor(type: string): string {
  if (type.startsWith("PHI")) return "#5FB3A8";
  if (type.startsWith("PFI")) return "#DCB87E";
  if (type.startsWith("PII")) return "#B197D6";
  return "#C8D2E0";
}

function Chip({ label, hex }: { label: string; hex: string }) {
  return (
    <span
      className="mx-1 inline-flex items-center rounded-full px-3 py-1 font-mono text-[12px]"
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
  "w-full rounded-xl border border-white/10 bg-obsidian-900/60 px-4 py-3 font-mono text-[14px] leading-relaxed text-mercury-bright outline-none focus-visible:border-mercury/40";
const fieldLabel = "font-mono text-[12px] text-mercury/55";
const sectionLabel = "label text-mercury-deep/90";

export function CloakTool() {
  const [prompt, setPrompt] = useState("");
  const [data, setData] = useState("");
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
      setResult(await smartMask(data, prompt));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const bundle = result ? `${prompt.trim()}\n\n${result.maskedText}`.trim() : "";

  return (
    <main className="relative z-[10] mx-auto min-h-[100svh] w-[94vw] max-w-[100rem] px-6 py-14">
      <a href="/" className="font-mono text-[13px] text-mercury/60 hover:text-mercury-bright">
        ← Cloakroom
      </a>

      <header className="mt-6">
        <h1 className="font-display text-[clamp(2.2rem,5vw,3.2rem)] font-semibold tracking-[-0.025em] text-mercury-bright">
          Prompt-aware cloak
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-[15px] leading-relaxed text-mercury/70">
          Paste your data and what you want done. Cloakroom finds and masks the sensitive values; an
          open model decides what to keep for your task. Copy the masked text into any LLM, then paste
          its reply back to restore the real values — locally.
        </p>
      </header>

      {/* explanation strip */}
      <div className="mt-8 grid items-start gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#5FB3A8]/25 bg-[#5FB3A8]/[0.05] p-5 text-[14px] leading-relaxed text-mercury/80">
          <span className="font-medium text-mercury-bright">🔒 No LLM sees your data.</span> Cloakroom's
          own engine finds and masks the values. The model that tailors masking to your task is shown
          only the categories found (e.g. “email”, “account”) and your prompt — never the data itself.
          The token map stays in this browser tab and is wiped when you close it.
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <span className={sectionLabel}>how to use</span>
          <ol className="mt-4 grid gap-3.5 sm:grid-cols-3">
            {[
              ["Cloak", "Add your data and what you want the AI to do, then hit “Cloak with AI”."],
              ["Send to any LLM", "Copy the masked block into ChatGPT, Claude, Perplexity — it only ever sees tokens."],
              ["Uncloak", "Paste the reply into box 3; tokens turn back into your real values, locally."],
            ].map(([t, d], i) => (
              <li key={i} className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-mercury/75">
                <span className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mercury text-[11px] font-semibold text-obsidian-900">
                    {i + 1}
                  </span>
                  <span className="font-medium text-mercury-bright">{t}</span>
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* working pipeline — all three boxes on screen at once */}
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        {/* 1 — request */}
        <GlassPanel className="p-6 sm:p-7" specular={false}>
          <div className="flex flex-col gap-7">
            <span className={sectionLabel}>1 · Your request</span>

            <div className="flex flex-col gap-3">
              <label htmlFor="prompt" className={fieldLabel}>
                what you want the AI to do
              </label>
              <AutoTextarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                minRows={5}
                spellCheck={false}
                className={ta}
                placeholder="e.g. Draft a polite reply to this refund request and list the next steps the customer should take."
              />
            </div>

            <div className="flex flex-col gap-3">
              <label htmlFor="data" className={fieldLabel}>
                the data to cloak
              </label>
              <AutoTextarea
                id="data"
                value={data}
                onChange={(e) => setData(e.target.value)}
                minRows={20}
                spellCheck={false}
                className={ta}
                placeholder="Paste the data you want to work with — a customer record, an email, a support ticket, a spreadsheet row…"
              />
            </div>

            <div className="mt-1 flex items-center justify-between gap-4">
              {error ? <span className="font-mono text-[12px] text-[#DCB87E]">{error}</span> : <span />}
              <MercuryButton onClick={cloak} disabled={loading}>
                {loading ? "Cloaking…" : "Cloak with AI"}
              </MercuryButton>
            </div>
          </div>
        </GlassPanel>

        {/* right column — masked output + uncloak */}
        <div className="flex flex-col gap-6">
          {/* 2 — masked output */}
          <GlassPanel className="p-6 sm:p-7" specular={false}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <span className={sectionLabel}>2 · Send this to your LLM</span>
                {result && <CopyButton text={bundle} label="Copy prompt + masked" />}
              </div>

              {result ? (
                <>
                  <pre className="max-h-[36rem] min-h-[18rem] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-obsidian-900/60 px-4 py-3 font-mono text-[14px] leading-relaxed text-mercury/85">
                    {bundle}
                  </pre>
                  {result.masked.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mercury-deep">masked</span>
                      <div className="flex flex-wrap gap-y-2">
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
                            <span className="text-mercury-bright">{k.type}</span>{k.reason ? ` — ${k.reason}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.masked.length === 0 && <span className="font-mono text-[12px] text-mercury/55">Nothing was masked for this task.</span>}
                </>
              ) : (
                <p className="flex min-h-[18rem] items-center justify-center rounded-xl border border-dashed border-white/10 bg-obsidian-900/40 px-4 text-center font-mono text-[13px] leading-relaxed text-mercury/45">
                  Your masked, LLM-safe text appears here once you cloak.
                </p>
              )}
            </div>
          </GlassPanel>

          {/* 3 — uncloak */}
          <GlassPanel className="p-6 sm:p-7" specular={false}>
            <div className="flex flex-col gap-4">
              <span className={sectionLabel}>3 · Uncloak the reply</span>
              <AutoTextarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                minRows={14}
                spellCheck={false}
                className={ta}
                placeholder="Paste the LLM's reply (with tokens) here…"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-mercury/45">
                  {result ? "Tokens restore locally — nothing is sent." : "Cloak something first to get tokens to restore."}
                </span>
                <MercuryButton
                  onClick={() => result && setRestored(unmask(reply, result.map))}
                  disabled={!result || !reply.trim()}
                >
                  Uncloak reply
                </MercuryButton>
              </div>
              {restored !== null && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mercury-deep">restored</span>
                    <CopyButton text={restored} />
                  </div>
                  <p className="whitespace-pre-wrap rounded-xl border border-white/10 bg-obsidian-900/60 px-4 py-3 text-[15px] leading-relaxed text-mercury-bright">
                    {restored}
                  </p>
                </div>
              )}
            </div>
          </GlassPanel>
        </div>
      </div>
    </main>
  );
}
