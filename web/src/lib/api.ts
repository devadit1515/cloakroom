import type { ProcessOptions, ProcessResponse } from "./types";
import { mockProcess, deriveTokensFromMasked } from "./mock";

const API_BASE = (import.meta.env.VITE_CLOAKROOM_API as string | undefined) ?? "";

/** Send valid JSON as a parsed object so the backend can apply field-name hints
 *  (e.g. "account_number" -> bank account); otherwise send the raw string. */
function toPayload(input: string): unknown {
  const t = input.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.parse(t);
    } catch {
      /* not valid JSON — fall through to plain text */
    }
  }
  return input;
}

/** Try the real Cloakroom service; fall back silently to the in-browser mock pipeline.
 *  Both paths return an identical shape, so the UI never knows the difference. */
export async function processPayload(
  input: string,
  opts: ProcessOptions = {}
): Promise<ProcessResponse> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${API_BASE}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: toPayload(input),
        session_id: opts.sessionId,
        context: opts.context,
        instruction: opts.instruction,
        strategy: opts.strategy,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`process ${res.status}`);
    const data = await res.json();
    return {
      output: data.output ?? "",
      session_id: data.session_id ?? opts.sessionId ?? "live-session",
      masked_payload: data.masked_payload ?? "",
      llm_raw_output: data.llm_raw_output ?? "",
      detected_counts: data.detected_counts ?? {},
      flagged_leaks: data.flagged_leaks ?? [],
      tokens: Array.isArray(data.tokens)
        ? data.tokens
        : deriveTokensFromMasked(data.masked_payload ?? ""),
      source: "live",
    };
  } catch {
    return mockProcess(input, opts);
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_BASE}/healthz`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}
