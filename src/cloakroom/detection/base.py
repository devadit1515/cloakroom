"""Detector interface + a shared overlap-resolution helper.

A Detector turns raw text into a list of Spans (category + subtype + offsets).
Backends (regex, Presidio, cloud DLP) are interchangeable behind this interface.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterable

from cloakroom.models import Span


class Detector(ABC):
    @abstractmethod
    def detect(self, text: str, context: str | None = None) -> list[Span]:
        """Return non-overlapping sensitive spans, sorted by start offset.

        `context` is an optional hint (e.g. "financial", "medical") that lets the
        same value be classified differently across records.
        """


def dedupe_overlaps(spans: Iterable[Span]) -> list[Span]:
    """Resolve overlaps: prefer earlier start, then longer span, then higher score."""
    chosen: list[Span] = []
    occupied: list[tuple[int, int]] = []
    ordered = sorted(spans, key=lambda s: (s.start, -(s.end - s.start), -s.score))
    for s in ordered:
        if any(not (s.end <= a or s.start >= b) for a, b in occupied):
            continue  # overlaps an already-accepted span
        chosen.append(s)
        occupied.append((s.start, s.end))
    return sorted(chosen, key=lambda s: s.start)
