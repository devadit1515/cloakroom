"""In-memory vault: encrypted values, per-token TTL, session isolation.

Default zero-dependency backend. State lives only in this process; use RedisVault
for multi-process or persistence. Clock is injectable for deterministic TTL tests.
"""
from __future__ import annotations

import time
from typing import Callable

from cloakroom.vault.base import Vault
from cloakroom.vault.crypto import Crypto


class InMemoryVault(Vault):
    def __init__(
        self,
        crypto: Crypto,
        ttl_seconds: int = 3600,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._crypto = crypto
        self._ttl = ttl_seconds
        self._clock = clock
        # session_id -> { token -> (encrypted_value, expiry_epoch) }
        self._store: dict[str, dict[str, tuple[bytes, float]]] = {}

    def put(self, session_id: str, token: str, value: str) -> None:
        bucket = self._store.setdefault(session_id, {})
        bucket[token] = (self._crypto.encrypt(value), self._clock() + self._ttl)

    def get(self, session_id: str, token: str) -> str | None:
        bucket = self._store.get(session_id)
        if not bucket:
            return None
        entry = bucket.get(token)
        if entry is None:
            return None
        enc, expiry = entry
        if self._clock() > expiry:
            del bucket[token]
            return None
        return self._crypto.decrypt(enc)

    def get_map(self, session_id: str) -> dict[str, str]:
        bucket = self._store.get(session_id)
        if not bucket:
            return {}
        now = self._clock()
        out: dict[str, str] = {}
        for token in list(bucket.keys()):
            enc, expiry = bucket[token]
            if now > expiry:
                del bucket[token]
                continue
            out[token] = self._crypto.decrypt(enc)
        return out

    def delete_session(self, session_id: str) -> None:
        self._store.pop(session_id, None)
