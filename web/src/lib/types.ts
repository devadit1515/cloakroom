export type Category = "PII" | "PHI" | "PFI";

export interface TokenInfo {
  token: string;
  value: string;
  category: Category;
  subtype: string;
}

export interface FlaggedLeak {
  text: string;
  category: Category;
  subtype: string;
}

export interface ProcessResponse {
  output: string;
  session_id: string;
  masked_payload: string;
  llm_raw_output: string;
  detected_counts: Record<string, number>;
  flagged_leaks: FlaggedLeak[];
  /** UI-only: the real backend never returns the mapping (by design). The mock does, so the
   *  hero/playground can render the morph. When source==="live" this is derived from masked_payload. */
  tokens: TokenInfo[];
  source: "live" | "mock";
}

export type MaskStrategyName = "token" | "redact" | "format_preserving" | "prefix";

export interface ProcessOptions {
  sessionId?: string;
  context?: string;
  instruction?: string;
  strategy?: MaskStrategyName;
}

export const STRATEGY_OPTIONS: { key: MaskStrategyName; label: string; hint: string }[] = [
  { key: "token", label: "Token", hint: "reversible · LLM round-trip" },
  { key: "format_preserving", label: "Format-preserving", hint: "reversible · keeps shape" },
  { key: "redact", label: "Redact", hint: "one-way · drops the value" },
  { key: "prefix", label: "Sortable", hint: "one-way · keeps sort order" },
];

export const CATEGORY_META: Record<Category, { label: string; full: string; cssVar: string; hex: string }> = {
  PII: { label: "PII", full: "Identity", cssVar: "var(--pii)", hex: "#B197D6" },
  PHI: { label: "PHI", full: "Health", cssVar: "var(--phi)", hex: "#5FB3A8" },
  PFI: { label: "PFI", full: "Financial", cssVar: "var(--pfi)", hex: "#DCB87E" },
};
