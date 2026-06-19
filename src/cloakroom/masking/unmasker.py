"""Restoration layer: swap tokens back to real values + flag any LLM-generated leaks.

`restore` is what makes the masking invisible to the end user. `secondary_scan`
is the output-side safety net: it re-runs detection on the LLM output to catch
raw sensitive values the model may have generated that were never tokens.
"""
from __future__ import annotations

import re

from cloakroom.detection.base import Detector
from cloakroom.models import FlaggedLeak
from cloakroom.vault.base import Vault

_TOKEN_RE = re.compile(r"\[[A-Z0-9_]+\]")


class Unmasker:
    def __init__(self, vault: Vault, detector: Detector | None = None) -> None:
        self._vault = vault
        self._detector = detector

    def restore(self, text: str, session_id: str) -> str:
        mapping = self._vault.get_map(session_id)  # token -> value
        # Replace longer tokens first so no token is a prefix of another.
        for token in sorted(mapping, key=len, reverse=True):
            text = text.replace(token, mapping[token])
        return text

    def secondary_scan(
        self,
        llm_output: str,
        context: str | None = None,
        known_placeholders: set[str] | None = None,
    ) -> list[FlaggedLeak]:
        if self._detector is None:
            return []
        known = known_placeholders or set()
        token_spans = [(m.start(), m.end()) for m in _TOKEN_RE.finditer(llm_output)]
        leaks: list[FlaggedLeak] = []
        for s in self._detector.detect(llm_output, context):
            # Ignore anything inside a [TOKEN] or equal to a known strategy placeholder
            # (e.g. a format-preserving fake), so only model-invented values are flagged.
            if s.text in known:
                continue
            if any(not (s.end <= a or s.start >= b) for a, b in token_spans):
                continue
            leaks.append(FlaggedLeak(text=s.text, category=s.category, subtype=s.subtype))
        return leaks
