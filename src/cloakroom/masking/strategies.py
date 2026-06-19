"""Masking strategies — *how* a detected value is replaced.

The detector decides *what* is sensitive; a strategy decides what it becomes.
All strategies are deterministic per value (same input -> same placeholder), so
entity relationships survive within and across turns.

  token             [PFI_ACCOUNT_1]      reversible   default; the LLM round-trip path
  redact            ••••••• •••••        one-way      drop the value entirely
  format_preserving 918273645501         reversible   keep shape/length (valid-looking)
  prefix (sortable) P••••••              one-way      keep leading chars -> stays sortable

`reversible` strategies are stored in the vault so the answer can be restored;
one-way strategies are not (there is nothing to put back).
"""
from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod

from cloakroom.models import Category

DEFAULT_MASK_CHAR = "•"


class MaskStrategy(ABC):
    name: str
    reversible: bool

    @abstractmethod
    def placeholder(self, value: str, category: Category, subtype: str, index: int) -> str:
        """Return the replacement string for `value`. `index` is the 1-based
        per-(category, subtype) counter, used only by token-style naming."""


class TokenStrategy(MaskStrategy):
    name = "token"
    reversible = True

    def placeholder(self, value: str, category: Category, subtype: str, index: int) -> str:
        return f"[{category.value}_{subtype.upper()}_{index}]"


class RedactStrategy(MaskStrategy):
    """Irreversible: every non-space character becomes the mask char (length kept)."""

    name = "redact"
    reversible = False

    def __init__(self, mask_char: str = DEFAULT_MASK_CHAR) -> None:
        self._c = mask_char

    def placeholder(self, value: str, category: Category, subtype: str, index: int) -> str:
        return "".join(ch if ch.isspace() else self._c for ch in value)


class FormatPreservingStrategy(MaskStrategy):
    """Reversible: emit a fake value of the SAME shape (digit->digit, A->A, a->a),
    keeping separators/symbols. Deterministic per value via SHA-256, so it is stable."""

    name = "format_preserving"
    reversible = True

    def placeholder(self, value: str, category: Category, subtype: str, index: int) -> str:
        seed = hashlib.sha256(value.encode("utf-8")).digest()
        out: list[str] = []
        i = 0
        for ch in value:
            b = seed[i % len(seed)]
            if ch.isdigit():
                out.append(str(b % 10)); i += 1
            elif ch.isupper():
                out.append(chr(ord("A") + b % 26)); i += 1
            elif ch.islower():
                out.append(chr(ord("a") + b % 26)); i += 1
            else:
                out.append(ch)  # separators, currency, spaces preserved
        return "".join(out)


class PrefixStrategy(MaskStrategy):
    """One-way but order-preserving: keep the first `keep` chars, mask the rest.
    Output sorts alphabetically by the retained prefix (good for anonymized exports)."""

    name = "prefix"
    reversible = False

    def __init__(self, keep: int = 1, mask_char: str = DEFAULT_MASK_CHAR) -> None:
        self._keep = max(0, keep)
        self._c = mask_char

    def placeholder(self, value: str, category: Category, subtype: str, index: int) -> str:
        head = value[: self._keep]
        tail = "".join(ch if ch.isspace() else self._c for ch in value[self._keep :])
        return head + tail


def strategy_from_name(name: str | None, prefix_keep: int = 1, mask_char: str = DEFAULT_MASK_CHAR) -> MaskStrategy:
    key = (name or "token").lower()
    if key == "redact":
        return RedactStrategy(mask_char)
    if key in ("format_preserving", "format", "fpe"):
        return FormatPreservingStrategy()
    if key in ("prefix", "sortable"):
        return PrefixStrategy(prefix_keep, mask_char)
    return TokenStrategy()
