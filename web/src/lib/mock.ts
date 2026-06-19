import type { Category, FlaggedLeak, MaskStrategyName, ProcessOptions, ProcessResponse, TokenInfo } from "./types";

/** In-browser mirror of the Cloakroom pipeline: detect -> mask -> (mock) reason -> unmask.
 *  Used only when the real POST /process is unreachable; returns the identical shape. */

interface Span {
  start: number;
  end: number;
  value: string;
  category: Category;
  subtype: string;
  prio: number;
}

const CONDITIONS = [
  "diabetes", "hypertension", "asthma", "cancer", "hiv", "depression", "anxiety",
  "arthritis", "migraine", "obesity", "copd", "anemia", "hepatitis", "tuberculosis",
  "alzheimer", "parkinson", "cardiac arrhythmia", "hypothyroidism",
];
const MEDICATIONS = [
  "metformin", "insulin", "atorvastatin", "amlodipine", "aspirin", "ibuprofen",
  "omeprazole", "paracetamol", "lisinopril", "levothyroxine", "warfarin", "prednisone",
];

function luhnValid(digits: string): boolean {
  const s = digits.replace(/\D/g, "");
  if (s.length < 13 || s.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let d = Number(s[i]);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function normalize(value: string, subtype: string): string {
  const numeric = ["account", "card", "amount", "aadhaar", "phone", "ifsc", "pan"];
  if (numeric.includes(subtype)) return value.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
  return value.trim().toLowerCase();
}

function isNameKey(key?: string): boolean {
  return !!key && /(^|_)(name|customer|holder|client|person|patient|contact)(_|$)/i.test(key);
}

function lexiconMatches(text: string, words: string[]): { start: number; end: number; value: string }[] {
  const out: { start: number; end: number; value: string }[] = [];
  for (const w of words) {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("\\b" + escaped + "\\b", "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.push({ start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  return out;
}

/** Detect sensitive spans. nameField=true forces a whole-value person span (JSON name-ish keys). */
function detectSpans(text: string, nameField = false): Span[] {
  if (nameField && /^[A-Za-z][A-Za-z .'-]{1,38}$/.test(text.trim()) && !/\d/.test(text)) {
    return [{ start: 0, end: text.length, value: text, category: "PII", subtype: "person", prio: 0 }];
  }

  const spans: Span[] = [];
  const add = (start: number, end: number, value: string, category: Category, subtype: string, prio: number) =>
    spans.push({ start, end, value, category, subtype, prio });

  const run = (re: RegExp, cat: Category, sub: string, prio: number, valid?: (v: string) => boolean) => {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const v = m[0];
      if (!valid || valid(v)) add(m.index, m.index + v.length, v, cat, sub, prio);
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  };

  run(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "PII", "email", 1);
  run(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, "PFI", "ifsc", 2);
  run(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, "PII", "pan", 3);
  run(/\b(?:\d[ -]?){13,19}\b/g, "PFI", "card", 4, luhnValid);
  run(/\b\d{4}\s\d{4}\s\d{4}\b/g, "PII", "aadhaar", 5);
  run(/(?:₹|Rs\.?|INR|\$)\s?\d[\d,]*(?:\.\d+)?/gi, "PFI", "amount", 6);
  run(/\b(?:Mr|Ms|Mrs|Dr)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g, "PII", "person", 9);
  run(/\bPrachan(?:\s+Mehta)?\b/g, "PII", "person", 9);
  run(/(?:\+91[-\s]?)?\b[6-9]\d{9}\b/g, "PII", "phone", 10);
  run(/\b\d{9,18}\b/g, "PFI", "account", 11);

  for (const c of lexiconMatches(text, CONDITIONS)) add(c.start, c.end, c.value, "PHI", "condition", 7);
  for (const m of lexiconMatches(text, MEDICATIONS)) add(m.start, m.end, m.value, "PHI", "medication", 8);

  // resolve overlaps: earliest start, then longest, then highest-priority recognizer
  spans.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.prio - b.prio);
  const chosen: Span[] = [];
  let cursor = -1;
  for (const s of spans) {
    if (s.start >= cursor) {
      chosen.push(s);
      cursor = s.end;
    }
  }
  return chosen;
}

// --- masking strategies (mirror of src/cloakroom/masking/strategies.py) ---

export const REVERSIBLE: Record<MaskStrategyName, boolean> = {
  token: true,
  format_preserving: true,
  redact: false,
  prefix: false,
};

const MASK = "•";

/** Deterministic byte stream from a string (FNV-1a derived) — for format-preserving. */
function seededBytes(s: string): number[] {
  let h = 0x811c9dc5;
  const out: number[] = [];
  const len = Math.max(s.length, 8);
  for (let i = 0; i < len; i++) {
    h ^= s.charCodeAt(i % s.length) || i + 1;
    h = Math.imul(h, 0x01000193) >>> 0;
    out.push(h & 0xff);
  }
  return out;
}

function redactValue(v: string): string {
  return [...v].map((c) => (/\s/.test(c) ? c : MASK)).join("");
}

function prefixValue(v: string, keep = 1): string {
  return v.slice(0, keep) + [...v.slice(keep)].map((c) => (/\s/.test(c) ? c : MASK)).join("");
}

function fpeValue(v: string): string {
  const b = seededBytes(v);
  let i = 0;
  let out = "";
  for (const ch of v) {
    const byte = b[i % b.length];
    if (/[0-9]/.test(ch)) { out += String(byte % 10); i++; }
    else if (/[A-Z]/.test(ch)) { out += String.fromCharCode(65 + (byte % 26)); i++; }
    else if (/[a-z]/.test(ch)) { out += String.fromCharCode(97 + (byte % 26)); i++; }
    else out += ch; // separators / symbols / spaces preserved
  }
  return out;
}

class Masker {
  private map = new Map<string, string>();
  private counters = new Map<string, number>();
  tokens: TokenInfo[] = [];

  constructor(private strategy: MaskStrategyName = "token") {}

  tokenFor(value: string, category: Category, subtype: string): string {
    const key = `${category}:${subtype}:${normalize(value, subtype)}`;
    const existing = this.map.get(key);
    if (existing) return existing;
    const ckey = `${category}_${subtype}`;
    const n = (this.counters.get(ckey) ?? 0) + 1;
    this.counters.set(ckey, n);

    let placeholder: string;
    switch (this.strategy) {
      case "redact": placeholder = redactValue(value); break;
      case "prefix": placeholder = prefixValue(value); break;
      case "format_preserving": placeholder = fpeValue(value); break;
      default: placeholder = `[${category}_${subtype.toUpperCase()}_${n}]`;
    }
    this.map.set(key, placeholder);
    this.tokens.push({ token: placeholder, value, category, subtype });
    return placeholder;
  }
}

function maskText(text: string, masker: Masker, nameField = false): string {
  const spans = detectSpans(text, nameField);
  let out = text;
  for (const s of [...spans].sort((a, b) => b.start - a.start)) {
    const token = masker.tokenFor(s.value, s.category, s.subtype);
    out = out.slice(0, s.start) + token + out.slice(s.end);
  }
  return out;
}

function maskJsonValue(val: unknown, masker: Masker, key?: string): unknown {
  if (typeof val === "string") return maskText(val, masker, isNameKey(key));
  if (Array.isArray(val)) return val.map((v) => maskJsonValue(v, masker));
  if (val && typeof val === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) o[k] = maskJsonValue(v, masker, k);
    return o;
  }
  return val;
}

function tryParseJson(input: string): unknown | null {
  const t = input.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function pick(tokens: TokenInfo[], subtype: string): string | null {
  return tokens.find((t) => t.subtype === subtype)?.token ?? null;
}

/** Deterministic stand-in for the model: reasons over tokens only, never raw values. */
function mockReason(tokens: TokenInfo[], instruction?: string): string {
  const person = pick(tokens, "person");
  const account = pick(tokens, "account") ?? pick(tokens, "card");
  const amount = pick(tokens, "amount");
  const condition = pick(tokens, "condition");
  const medication = pick(tokens, "medication");

  if (tokens.length === 0) {
    return "No sensitive entities were present, so the record was passed through unchanged. Nothing in the input indicates anomalous activity.";
  }

  const parts: string[] = [];
  const subject = person ? `Customer ${person}` : "The customer";
  if (account && amount) parts.push(`${subject} maintains account ${account}, with a recent order of ${amount}.`);
  else if (account) parts.push(`${subject} maintains account ${account}.`);
  else if (amount) parts.push(`${subject} placed an order of ${amount}.`);
  else parts.push(`${subject} appears in this record.`);

  if (condition) {
    parts.push(
      medication
        ? `A health note references ${condition}, with ${medication} prescribed.`
        : `A health note references ${condition}.`
    );
  }
  parts.push("The masked values reveal no anomaly; the transaction sits within the expected range.");
  const lead = instruction ? "Summary: " : "";
  return lead + parts.join(" ");
}

function unmask(text: string, tokens: TokenInfo[], reversible: boolean): string {
  if (!reversible) return text; // one-way strategies have nothing to restore
  let out = text;
  for (const t of tokens) out = out.split(t.token).join(t.value);
  return out;
}

const TOKEN_RE = /\[(PII|PHI|PFI)_([A-Z]+)_(\d+)\]/g;

/** Build TokenInfo placeholders from a masked string (used when the live backend omits the map). */
export function deriveTokensFromMasked(masked: string): TokenInfo[] {
  const seen = new Set<string>();
  const out: TokenInfo[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(masked)) !== null) {
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    out.push({ token: m[0], value: "", category: m[1] as Category, subtype: m[2].toLowerCase() });
  }
  return out;
}

function countByCategory(tokens: TokenInfo[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of tokens) {
    const key = `${t.category}:${t.subtype}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Secondary scan: any raw sensitive value in the model output that is NOT a token is a leak. */
function scanLeaks(modelOutput: string): FlaggedLeak[] {
  const stripped = modelOutput.replace(TOKEN_RE, " ");
  return detectSpans(stripped).map((s) => ({ text: s.value, category: s.category, subtype: s.subtype }));
}

export function mockProcess(input: string, opts: ProcessOptions = {}): ProcessResponse {
  const strategy: MaskStrategyName = opts.strategy ?? "token";
  const masker = new Masker(strategy);
  const parsed = tryParseJson(input);

  let masked_payload: string;
  if (parsed !== null) {
    masked_payload = JSON.stringify(maskJsonValue(parsed, masker), null, 2);
  } else {
    masked_payload = maskText(input, masker);
  }

  const llm_raw_output = mockReason(masker.tokens, opts.instruction);
  const output = unmask(llm_raw_output, masker.tokens, REVERSIBLE[strategy]);

  return {
    output,
    session_id: opts.sessionId ?? "mock-session",
    masked_payload,
    llm_raw_output,
    detected_counts: countByCategory(masker.tokens),
    flagged_leaks: scanLeaks(llm_raw_output),
    tokens: masker.tokens,
    source: "mock",
  };
}
