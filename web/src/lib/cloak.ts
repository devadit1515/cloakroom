// Prompt-aware masking with NO LLM seeing your data.
// Cloakroom's own detector finds + masks values on the server; a hosted open
// model (Groq) is shown only the TASK and the category names found (never the
// values) to decide what to keep. Unmasking happens locally — the token->value
// map never leaves this browser tab.

const API_BASE = (import.meta.env.VITE_CLOAKROOM_API as string | undefined) ?? "";

export interface MaskedItem {
  token: string;
  value: string;
  type: string;
}

export interface KeptItem {
  type: string;
  reason: string;
}

export interface CloakResult {
  maskedText: string;
  map: Record<string, string>; // token -> real value
  masked: MaskedItem[];
  kept: KeptItem[];
}

/** Detect + mask on the server; returns masked text + the token->value map. */
export async function smartMask(data: string, prompt: string): Promise<CloakResult> {
  const res = await fetch(`${API_BASE}/smart-mask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, prompt }),
  });
  if (!res.ok) {
    if (res.status === 503)
      throw new Error("Server isn't configured yet — add GROQ_API_KEY in Vercel, then redeploy.");
    let detail = "";
    try {
      detail = (await res.json())?.detail ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(`smart-mask ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  const json = await res.json();
  return {
    maskedText: json.masked_payload ?? "",
    map: json.mapping ?? {},
    masked: Array.isArray(json.masked) ? json.masked : [],
    kept: Array.isArray(json.kept) ? json.kept : [],
  };
}

const TOKEN_RE = /\[[A-Z][A-Z0-9_]*\]/g;

/** Restore real values from a token->value map (local, no network). */
export function unmask(text: string, map: Record<string, string>): string {
  return text.replace(TOKEN_RE, (t) => (t in map ? map[t] : t));
}
