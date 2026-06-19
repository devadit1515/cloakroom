"""Presidio detector tests — the free, open-source real-NER path.

These run only when presidio-analyzer and the spaCy model are installed
(`pip install -e ".[presidio]" && python -m spacy download en_core_web_sm`);
otherwise the whole module is skipped, so the default test run stays dependency-free.
"""
from __future__ import annotations

import pytest

pytest.importorskip("presidio_analyzer")

from cloakroom.detection.presidio_detector import PresidioDetector  # noqa: E402


@pytest.fixture(scope="module")
def detector():
    try:
        return PresidioDetector()
    except Exception as e:  # spaCy model not downloaded, etc.
        pytest.skip(f"Presidio/spaCy model unavailable: {e}")


def test_detects_freetext_person_name(detector):
    # A name that appears only in prose — regex alone (no structured field) can't catch this.
    spans = detector.detect("John Smith visited the clinic for a routine checkup.")
    assert any(s.subtype == "person" and "Smith" in s.text for s in spans)


def test_composes_regex_for_structured_ids(detector):
    # India-specific structured IDs come from the composed RegexDetector, not Presidio.
    spans = detector.detect("Please credit IFSC ICIC0001234 from PAN ABCPM1234K.")
    subtypes = {s.subtype for s in spans}
    assert "ifsc" in subtypes
    assert "pan" in subtypes
