"""Vault interface: a session-scoped, encrypted, TTL'd token<->value store.

Swap the backend (in-memory, Redis, cloud secret store) without touching callers.
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class Vault(ABC):
    @abstractmethod
    def put(self, session_id: str, token: str, value: str) -> None:
        """Store (or overwrite) a token->value mapping for a session."""

    @abstractmethod
    def get(self, session_id: str, token: str) -> str | None:
        """Return the real value for a token, or None if absent/expired."""

    @abstractmethod
    def get_map(self, session_id: str) -> dict[str, str]:
        """Return the full live token->value map for a session (decrypted)."""

    @abstractmethod
    def delete_session(self, session_id: str) -> None:
        """Drop all mappings for a session."""
