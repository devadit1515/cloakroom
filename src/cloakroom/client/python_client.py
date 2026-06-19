"""Thin HTTP client for the Cloakroom service (convenience wrapper over httpx)."""
from __future__ import annotations

from typing import Any

import httpx


class CloakroomClient:
    def __init__(self, base_url: str = "http://localhost:8000", timeout: float = 120.0) -> None:
        self._base = base_url.rstrip("/")
        self._timeout = timeout

    def create_session(self) -> str:
        r = httpx.post(f"{self._base}/session", timeout=self._timeout)
        r.raise_for_status()
        return r.json()["session_id"]

    def process(
        self,
        payload: Any,
        session_id: str | None = None,
        context: str | None = None,
        instruction: str | None = None,
    ) -> dict:
        r = httpx.post(
            f"{self._base}/process",
            json={
                "payload": payload,
                "session_id": session_id,
                "context": context,
                "instruction": instruction,
            },
            timeout=self._timeout,
        )
        r.raise_for_status()
        return r.json()

    def delete_session(self, session_id: str) -> None:
        httpx.delete(f"{self._base}/session/{session_id}", timeout=self._timeout).raise_for_status()
