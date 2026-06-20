// Prompt-aware masking. The mask/keep DECISION runs on a hosted free LLM (Groq,
// open models) behind our /decide proxy, so no API key ever touches the browser.
// Tokenizing and unmasking happen locally — the token->value map never leaves
// this device.

const API_BASE = (import.meta.env.VITE_CLOAKROOM_API as string | undefined) ?? "";

export interface Decision {
  value: string;
  type: string;
  action: "mask" | "keep";
  reason: string;
}

export interface CloakResult {
  maskedText: string;
  map: Record<string, string>; // token -> real value
  masked: { token: string; value: string; type: string }[];
  kept: Decision[];
}

/** Ask the server which values to mask/keep for this task. */
export async function decide(data: string, prompt: string): Promise<Decision[]> {
  const res = await fetch(`${API_BASE}/decide`, {
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
    throw new Error(`decide ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  const json = await res.json();
  return Array.isArray(json.items) ? json.items : [];
}

function sanitizeType(t: string): string {
  const s = (t || "DATA").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return s || "DATA";
}

/** Replace masked values with stable tokens; same value -> same token. */
export function applyDecisions(data: string, items: Decision[]): CloakResult {
  const map: Record<string, string> = {};
  const valueToToken: Record<string, string> = {};
  const counters: Record<string, number> = {};
  const masked: CloakResult["masked"] = [];

  // Longest values first so a value isn't partially clobbered by a shorter overlap.
  const toMask = items
    .filter((i) => i.action === "mask" && i.value && data.includes(i.value))
    .sort((a, b) => b.value.length - a.value.length);

  let maskedText = data;
  for (const it of toMask) {
    let token = valueToToken[it.value];
    if (!token) {
      const prefix = sanitizeType(it.type);
      const n = (counters[prefix] = (counters[prefix] || 0) + 1);
      token = `[${prefix}_${n}]`;
      valueToToken[it.value] = token;
      map[token] = it.value;
      masked.push({ token, value: it.value, type: prefix });
    }
    maskedText = maskedText.split(it.value).join(token); // literal, all occurrences
  }

  const kept = items.filter((i) => i.action === "keep" && i.value);
  return { maskedText, map, masked, kept };
}

const TOKEN_RE = /\[[A-Z][A-Z0-9_]*\]/g;

/** Restore real values from a token->value map (local, no network). */
export function unmask(text: string, map: Record<string, string>): string {
  return text.replace(TOKEN_RE, (t) => (t in map ? map[t] : t));
}
