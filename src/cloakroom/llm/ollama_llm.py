"""Local, free LLM provider via Ollama (optional; requires a running Ollama).

Uses Ollama's HTTP API so the same pipeline runs against a real on-device model
(e.g. `ollama run llama3.2`) with no paid key and no data leaving the host.
"""
from __future__ import annotations

import httpx

from cloakroom.llm.base import LLMProvider


class OllamaLLM(LLMProvider):
    def __init__(self, url: str = "http://localhost:11434", model: str = "llama3.2",
                 timeout: float = 120.0) -> None:
        self._url = url.rstrip("/")
        self._model = model
        self._timeout = timeout

    def complete(self, system: str, prompt: str) -> str:
        resp = httpx.post(
            f"{self._url}/api/chat",
            json={
                "model": self._model,
                "stream": False,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=self._timeout,
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]
