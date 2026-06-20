// Prompt-aware masking via Gemini (free tier), run entirely client-side with the
// user's own key. Gemini decides which values to mask vs keep given the TASK;
// tokenization and unmasking happen locally so the token->value map never leaves
// the browser.

const MODEL = "gemini-2.0-flash";
const ENDPOINT = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

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

const SYSTEM = `You are a privacy filter that prepares text before it is sent to a third-party LLM.
Given a TASK and DATA, find every sensitive value in DATA (names, phone numbers, emails, postal
addresses, government IDs like PAN/Aadhaar/SSN, bank accounts, IFSC/routing, card numbers, amounts,
dates of birth, medical conditions, etc).
For each, decide:
- "keep" ONLY if the value is genuinely required for the TASK to be answerable.
- "mask" otherwise (default to masking when unsure).
Use a short UPPERCASE type like PII_PERSON, PII_EMAIL, PII_PHONE, PFI_ACCOUNT, PFI_AMOUNT,
PFI_CARD, PHI_CONDITION, PII_ADDRESS, PII_ID.
Return STRICT JSON only: {"items":[{"value":"<exact substring copied verbatim from DATA>","type":"<TYPE>","action":"mask"|"keep","reason":"<short>"}]}.
Every "value" MUST appear verbatim in DATA. Do not invent values. No commentary.`;

/** Ask Gemini which values to mask/keep for this task. */
export async function geminiDecide(apiKey: string, data: string, prompt: string): Promise<Decision[]> {
  const res = await fetch(ENDPOINT(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `TASK:\n${prompt || "(no task given — mask all sensitive values)"}\n\nDATA:\n${data}` }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(`Gemini ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  const json = await res.json();
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned no content (check the key or model).");

  let parsed: { items?: Decision[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    // strip code fences if the model wrapped it
    parsed = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim());
  }
  return Array.isArray(parsed.items) ? parsed.items : [];
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
