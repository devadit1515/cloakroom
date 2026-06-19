"""LLM provider interface + the shared token-preservation system prompt.

Every provider (mock, Ollama, and any future Anthropic/OpenAI/Bedrock adapter)
implements `complete` and is given the same system prompt so token handling is
consistent regardless of which model runs.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

TOKEN_PRESERVATION_SYSTEM_PROMPT = (
    "You are analyzing de-identified data. Placeholder tokens of the form "
    "[CATEGORY_SUBTYPE_N] (for example [PII_PERSON_1], [PFI_ACCOUNT_1], "
    "[PHI_CONDITION_1]) stand in for real sensitive values that have been removed. "
    "RULES:\n"
    "1. Treat each token as an opaque, stable identifier for exactly one real entity.\n"
    "2. Reproduce every token EXACTLY as written, including the square brackets, "
    "wherever you refer to that entity in your output.\n"
    "3. NEVER guess, invent, expand, decode, or reveal what a token represents.\n"
    "4. Reason about relationships between tokens normally (e.g. the person who holds "
    "an account), but do not fabricate any new names, numbers, or other sensitive "
    "values that were not given to you as tokens.\n"
)


class LLMProvider(ABC):
    @abstractmethod
    def complete(self, system: str, prompt: str) -> str:
        """Return the model's text completion for `prompt` under `system` instructions."""
