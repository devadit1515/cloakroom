import type { Category } from "./types";

/** A segment of the hero sentence: plain text, or a sensitive value with its stable token. */
export interface HeroSegment {
  raw: string;
  token?: string;
  category?: Category;
  subtype?: string;
}

/** The piece of real-looking customer data at the heart of the vault. */
export const HERO_SEGMENTS: HeroSegment[] = [
  { raw: "Prachan Mehta", token: "[PII_PERSON_1]", category: "PII", subtype: "person" },
  { raw: " holds ICICI account " },
  { raw: "002233445566", token: "[PFI_ACCOUNT_1]", category: "PFI", subtype: "account" },
  { raw: " — order " },
  { raw: "₹84,500", token: "[PFI_AMOUNT_1]", category: "PFI", subtype: "amount" },
  { raw: " — flagged for " },
  { raw: "diabetes", token: "[PHI_CONDITION_1]", category: "PHI", subtype: "condition" },
  { raw: " follow-up." },
];

/** Default JSON record for the live playground (exercises every recognizer + JSON walking). */
export const PLAYGROUND_DEFAULT = JSON.stringify(
  {
    customer: "Prachan Mehta",
    bank: "ICICI",
    account_number: "002233445566",
    ifsc: "ICIC0001234",
    pan: "ABCPM1234K",
    order_amount: "₹84,500",
    note: "Follow up on diabetes management; prescribed Metformin.",
  },
  null,
  2
);

export const PLAYGROUND_INSTRUCTION =
  "Summarize this customer record in one sentence and flag anything unusual.";
