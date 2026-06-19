"""Core data models shared across all Cloakroom layers."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Category(str, Enum):
    """Top-level sensitivity class. Drives compliance regime (GDPR/HIPAA/PCI-DSS)."""

    PII = "PII"  # personally identifiable information
    PHI = "PHI"  # protected health information
    PFI = "PFI"  # sensitive financial information


@dataclass(frozen=True)
class Span:
    """A detected span of sensitive text within a source string."""

    start: int
    end: int
    text: str
    category: Category
    subtype: str
    score: float = 1.0

    @property
    def length(self) -> int:
        return self.end - self.start


@dataclass(frozen=True)
class TokenEntry:
    """A token <-> real-value pairing produced during masking."""

    token: str
    value: str
    category: Category
    subtype: str


@dataclass
class MaskResult:
    """Result of masking a single string: the placeholder text + the pairings created."""

    masked_text: str
    entries: list[TokenEntry] = field(default_factory=list)


@dataclass(frozen=True)
class FlaggedLeak:
    """A sensitive value found in LLM *output* that was not a known token.

    This is the secondary-scan safety net for generative tasks where the model
    may emit sensitive-looking content that never existed in the input.
    """

    text: str
    category: Category
    subtype: str


@dataclass
class ProcessResult:
    """Final result of a full detect -> mask -> LLM -> unmask cycle."""

    output: str                       # human-readable, fully de-tokenized
    session_id: str
    masked_payload: str               # exactly what was sent to the LLM (tokens only)
    llm_raw_output: str               # LLM output before unmasking
    detected_counts: dict[str, int] = field(default_factory=dict)  # "CATEGORY:subtype" -> n
    flagged_leaks: list[FlaggedLeak] = field(default_factory=list)
