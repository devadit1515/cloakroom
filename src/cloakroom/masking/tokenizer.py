"""Deterministic, session-consistent masking.

Replaces each detected span with a placeholder produced by a MaskStrategy
(default: `[CATEGORY_SUBTYPE_N]` tokens). The same raw value reuses the same
placeholder within a session — preserving entity relationships — and, for
reversible strategies, every placeholder->value pair is written to the encrypted
vault so the answer can be restored later. One-way strategies (redact, prefix)
write nothing; their placeholders are deterministic, so continuity still holds.
"""
from __future__ import annotations

from cloakroom.masking.strategies import MaskStrategy, TokenStrategy
from cloakroom.models import Category, MaskResult, Span, TokenEntry
from cloakroom.vault.base import Vault


class Tokenizer:
    def __init__(self, vault: Vault, session_id: str, strategy: MaskStrategy | None = None) -> None:
        self._vault = vault
        self._session = session_id
        self._strategy = strategy or TokenStrategy()
        self._value_to_placeholder: dict[str, str] = {}
        self._counters: dict[str, int] = {}
        if self._strategy.reversible:
            existing = vault.get_map(session_id)  # placeholder -> value
            self._value_to_placeholder = {v: p for p, v in existing.items()}
            for placeholder in existing:
                prefix, n = self._parse(placeholder)
                if prefix:
                    self._counters[prefix] = max(self._counters.get(prefix, 0), n)

    def mask(self, text: str, spans: list[Span]) -> MaskResult:
        # Assign placeholders in reading order so token numbering is left-to-right...
        ordered = sorted(spans, key=lambda s: s.start)
        assigned: list[tuple[Span, str]] = [
            (s, self._placeholder_for(s.text, s.category, s.subtype)) for s in ordered
        ]
        # ...but apply replacements right-to-left so offsets stay valid.
        masked = text
        for s, placeholder in sorted(assigned, key=lambda x: x[0].start, reverse=True):
            masked = masked[: s.start] + placeholder + masked[s.end :]

        entries_map: dict[str, TokenEntry] = {}
        for s, placeholder in assigned:
            entries_map[placeholder] = TokenEntry(placeholder, s.text, s.category, s.subtype)
        return MaskResult(masked_text=masked, entries=list(entries_map.values()))

    def _placeholder_for(self, value: str, category: Category, subtype: str) -> str:
        key = value.strip()
        if key in self._value_to_placeholder:
            return self._value_to_placeholder[key]  # relationship continuity
        prefix = f"{category.value}_{subtype.upper()}"
        n = self._counters.get(prefix, 0) + 1
        self._counters[prefix] = n
        placeholder = self._strategy.placeholder(value, category, subtype, n)
        self._value_to_placeholder[key] = placeholder
        if self._strategy.reversible:
            self._vault.put(self._session, placeholder, value)
        return placeholder

    @staticmethod
    def _parse(token: str) -> tuple[str | None, int]:
        body = token.strip("[]")
        head, _, tail = body.rpartition("_")
        if head and tail.isdigit():
            return head, int(tail)
        return None, 0
