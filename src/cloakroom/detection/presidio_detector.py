"""Presidio-backed detector (optional dependency: pip install cloakroom[presidio]).

Adds spaCy NER for names/locations and Presidio's Indian recognizers (PAN, Aadhaar),
then merges in the zero-dep RegexDetector for amounts / IFSC / medical terms that
Presidio does not cover out of the box. Same Detector interface.
"""
from __future__ import annotations

from cloakroom.detection import taxonomy
from cloakroom.detection.base import Detector, dedupe_overlaps
from cloakroom.detection.regex_detector import RegexDetector
from cloakroom.models import Span

# Presidio entity name -> our neutral entity type
_PRESIDIO_MAP = {
    "PERSON": "PERSON",
    "EMAIL_ADDRESS": "EMAIL",
    "PHONE_NUMBER": "PHONE",
    "CREDIT_CARD": "CREDIT_CARD",
    "IN_PAN": "PAN",
    "IN_AADHAAR": "AADHAAR",
    "LOCATION": "ADDRESS",
    "IBAN_CODE": "BANK_ACCOUNT",
    "US_BANK_NUMBER": "BANK_ACCOUNT",
}


class PresidioDetector(Detector):
    def __init__(
        self,
        person_names: list[str] | None = None,
        medical_terms: list[str] | None = None,
        language: str = "en",
        spacy_model: str = "en_core_web_sm",
    ) -> None:
        # optional deps, lazy imports
        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine import NlpEngineProvider

        # Use the lightweight small spaCy model by default (free, ~12MB) instead of
        # Presidio's en_core_web_lg default (~560MB). Override via the spacy_model arg.
        nlp_engine = NlpEngineProvider(
            nlp_configuration={
                "nlp_engine_name": "spacy",
                "models": [{"lang_code": language, "model_name": spacy_model}],
            }
        ).create_engine()
        self._engine = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=[language])
        self._language = language
        # Regex backend fills gaps Presidio lacks (amount, IFSC, medical lexicon).
        self._regex = RegexDetector(person_names=person_names, medical_terms=medical_terms)

    def detect(self, text: str, context: str | None = None) -> list[Span]:
        spans: list[Span] = []
        for r in self._engine.analyze(text=text, language=self._language):
            entity_type = _PRESIDIO_MAP.get(r.entity_type)
            if entity_type is None:
                continue
            category, subtype = taxonomy.resolve(entity_type, context)
            spans.append(
                Span(
                    start=r.start,
                    end=r.end,
                    text=text[r.start:r.end],
                    category=category,
                    subtype=subtype,
                    score=float(r.score),
                )
            )
        spans.extend(self._regex.detect(text, context))
        return dedupe_overlaps(spans)
