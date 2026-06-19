"""AWS detector: Amazon Comprehend (PII) + Comprehend Medical (PHI).

This is the AWS adapter for the detection layer. It calls two managed services:
  * Comprehend `detect_pii_entities`      -> names, contacts, financial identifiers
  * Comprehend Medical `detect_entities_v2` -> conditions, medications (PHI)

Comprehend does not recognise India-specific structured IDs (PAN, Aadhaar, IFSC) or
currency amounts, so by default this detector *composes* the zero-dependency
`RegexDetector` for those format-based spans and merges the results. Pass
`supplement=None` to disable that and use Comprehend alone.

The boto3 clients are injected (built lazily in `config.build_detector`), so this
module never imports boto3 itself and the unit tests run with fakes -- no AWS,
no credentials, no boto3 required.
"""
from __future__ import annotations

from cloakroom.detection.base import Detector, dedupe_overlaps
from cloakroom.detection.taxonomy import resolve
from cloakroom.models import Span

# Comprehend PII entity Type -> our neutral entity type (taxonomy.ENTITY_MAP keys).
COMPREHEND_PII_MAP: dict[str, str] = {
    "NAME": "PERSON",
    "EMAIL": "EMAIL",
    "PHONE": "PHONE",
    "ADDRESS": "ADDRESS",
    "BANK_ACCOUNT_NUMBER": "BANK_ACCOUNT",
    "CREDIT_DEBIT_NUMBER": "CREDIT_CARD",
}

# Comprehend Medical entity Category -> neutral entity type.
COMPREHEND_MEDICAL_MAP: dict[str, str] = {
    "MEDICAL_CONDITION": "MEDICAL_CONDITION",
    "MEDICATION": "MEDICATION",
}

_DEFAULT = object()  # sentinel: "no supplement argument given" vs. explicit None


class AwsComprehendDetector(Detector):
    def __init__(
        self,
        pii_client,
        phi_client=None,
        supplement: Detector | None | object = _DEFAULT,
        language_code: str = "en",
    ) -> None:
        self._pii = pii_client
        self._phi = phi_client
        self._lang = language_code
        if supplement is _DEFAULT:
            from cloakroom.detection.regex_detector import RegexDetector

            self._supplement: Detector | None = RegexDetector()
        else:
            self._supplement = supplement  # type: ignore[assignment]

    def detect(self, text: str, context: str | None = None) -> list[Span]:
        if not text:
            return []
        spans: list[Span] = []
        spans.extend(self._detect_pii(text, context))
        if self._phi is not None:
            spans.extend(self._detect_phi(text, context))
        if self._supplement is not None:
            spans.extend(self._supplement.detect(text, context))
        return dedupe_overlaps(spans)

    def _detect_pii(self, text: str, context: str | None) -> list[Span]:
        out: list[Span] = []
        resp = self._pii.detect_pii_entities(Text=text, LanguageCode=self._lang)
        for e in resp.get("Entities", []):
            entity_type = COMPREHEND_PII_MAP.get(e.get("Type", ""))
            if entity_type is None:
                continue  # type we don't model (SSN, PIN, routing, ...) -> ignore
            start, end = int(e["BeginOffset"]), int(e["EndOffset"])
            category, subtype = resolve(entity_type, context)
            out.append(Span(start, end, text[start:end], category, subtype, float(e.get("Score", 1.0))))
        return out

    def _detect_phi(self, text: str, context: str | None) -> list[Span]:
        out: list[Span] = []
        resp = self._phi.detect_entities_v2(Text=text)
        for e in resp.get("Entities", []):
            entity_type = COMPREHEND_MEDICAL_MAP.get(e.get("Category", ""))
            if entity_type is None:
                continue
            start, end = int(e["BeginOffset"]), int(e["EndOffset"])
            category, subtype = resolve(entity_type, context)
            out.append(Span(start, end, e.get("Text") or text[start:end], category, subtype, float(e.get("Score", 1.0))))
        return out
