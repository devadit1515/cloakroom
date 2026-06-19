"""Zero-setup LLM provider for tests and the no-API-key demo.

It performs no real inference; it produces a deterministic 'analysis' that echoes
every token from the input verbatim -- exactly the behaviour a well-behaved real
model exhibits -- so the full mask -> LLM -> unmask round-trip can be exercised
without any external service or paid key.
"""
from __future__ import annotations

import re

from cloakroom.llm.base import LLMProvider

_TOKEN_RE = re.compile(r"\[[A-Z0-9_]+\]")


class MockLLM(LLMProvider):
    def complete(self, system: str, prompt: str) -> str:
        tokens: list[str] = []
        for tok in _TOKEN_RE.findall(prompt):
            if tok not in tokens:
                tokens.append(tok)
        if not tokens:
            return "Mock LLM analysis: no sensitive tokens were present in the input."
        joined = ", ".join(tokens)
        return (
            f"Mock LLM analysis: this record involves {joined}. "
            f"The entity {tokens[0]} is linked to the other referenced entities; "
            f"no anomalies were detected across {joined}."
        )
