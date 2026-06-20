"""Zero-dependency detector: format/regex recognizers + optional lexicons.

Catches structured patterns (PAN, Aadhaar, IFSC, card+Luhn, phone, email, amount,
bank account) reliably. Free-text entities (person names, medical terms) are caught
via lexicons here; for full NER use the optional PresidioDetector backend.
"""
from __future__ import annotations

import re

from cloakroom.detection import taxonomy
from cloakroom.detection.base import Detector, dedupe_overlaps
from cloakroom.models import Span

# Default seed of medical conditions for the zero-dep PHI path (extend as needed).
DEFAULT_MEDICAL_TERMS = [
    "diabetes", "hypertension", "asthma", "cancer", "depression", "anxiety",
    "hiv", "covid", "tuberculosis", "migraine", "arthritis", "leukemia",
]

# Default seed of medications (PHI). Free-text only; extend or use Presidio/cloud NER.
DEFAULT_MEDICATIONS = [
    "metformin", "insulin", "atorvastatin", "amlodipine", "aspirin", "ibuprofen",
    "omeprazole", "paracetamol", "lisinopril", "levothyroxine", "warfarin",
    "prednisone", "amoxicillin", "metoprolol",
]


def _luhn_ok(digits: str) -> bool:
    digits = re.sub(r"\D", "", digits)
    if not 13 <= len(digits) <= 19:
        return False
    total, parity = 0, len(digits) % 2
    for i, ch in enumerate(digits):
        d = int(ch)
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


# (entity_type, compiled_pattern, score, validator, group)
# `group` is the capture group whose offsets define the span (0 = whole match).
# A 12-digit number is ambiguous (Aadhaar vs bank account); the keyworded account
# recognizer (higher score, group 1 = just the digits) resolves it via context.
_STRUCTURED = [
    ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), 0.99, None, 0),
    ("BANK_ACCOUNT", re.compile(
        r"(?i)\b(?:account|acct|a/c)(?:\s*(?:no|number|#))?[:#\s]*(\d{9,18})\b"), 0.98, None, 1),
    ("IFSC", re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b"), 0.97, None, 0),
    ("PAN", re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"), 0.96, None, 0),
    ("CREDIT_CARD", re.compile(r"\b\d(?:[ -]?\d){12,18}\b"), 0.95, _luhn_ok, 0),
    ("AADHAAR", re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b"), 0.94, None, 0),
    ("PHONE", re.compile(r"(?<!\d)(?:\+91[ -]?)?[6-9]\d{4}[ -]?\d{5}(?!\d)"), 0.92, None, 0),
    ("AMOUNT", re.compile(r"(?:₹|Rs\.?|INR|USD|\$)\s?\d[\d,]*(?:\.\d{1,2})?", re.IGNORECASE), 0.88, None, 0),
    ("BANK_ACCOUNT", re.compile(r"(?<!\d)\d{9,18}(?!\d)"), 0.60, None, 0),
]


class RegexDetector(Detector):
    def __init__(
        self,
        person_names: list[str] | None = None,
        medical_terms: list[str] | None = None,
        medications: list[str] | None = None,
    ) -> None:
        self._person_re = self._lexicon_re(person_names or [])
        self._medical_re = self._lexicon_re(medical_terms or DEFAULT_MEDICAL_TERMS)
        self._medication_re = self._lexicon_re(medications or DEFAULT_MEDICATIONS)

    @staticmethod
    def _lexicon_re(terms: list[str]) -> re.Pattern | None:
        if not terms:
            return None
        alt = "|".join(re.escape(t) for t in sorted(terms, key=len, reverse=True))
        return re.compile(rf"\b(?:{alt})\b", re.IGNORECASE)

    def detect(self, text: str, context: str | None = None) -> list[Span]:
        candidates: list[Span] = []

        for entity_type, pattern, score, validator, group in _STRUCTURED:
            for m in pattern.finditer(text):
                if validator and not validator(m.group(group)):
                    continue
                candidates.append(self._make_span(entity_type, m, score, context, group))

        if self._person_re:
            for m in self._person_re.finditer(text):
                candidates.append(self._make_span("PERSON", m, 0.85, context))
        if self._medical_re:
            for m in self._medical_re.finditer(text):
                candidates.append(self._make_span("MEDICAL_CONDITION", m, 0.85, context))
        if self._medication_re:
            for m in self._medication_re.finditer(text):
                candidates.append(self._make_span("MEDICATION", m, 0.85, context))

        return dedupe_overlaps(candidates)

    @staticmethod
    def _make_span(
        entity_type: str, m: re.Match, score: float, context: str | None, group: int = 0
    ) -> Span:
        category, subtype = taxonomy.resolve(entity_type, context)
        return Span(
            start=m.start(group),
            end=m.end(group),
            text=m.group(group),
            category=category,
            subtype=subtype,
            score=score,
        )
