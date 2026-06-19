"""Redis-backed vault adapter (optional dependency: pip install cloakroom[redis]).

Each session is one Redis hash (token -> encrypted value) with a TTL on the hash,
refreshed on every write. Same interface as InMemoryVault.
"""
from __future__ import annotations

from cloakroom.vault.base import Vault
from cloakroom.vault.crypto import Crypto


class RedisVault(Vault):
    def __init__(self, crypto: Crypto, redis_url: str, ttl_seconds: int = 3600) -> None:
        import redis  # optional dep, imported lazily

        self._crypto = crypto
        self._ttl = ttl_seconds
        self._r = redis.Redis.from_url(redis_url)

    def _key(self, session_id: str) -> str:
        return f"cloakroom:session:{session_id}"

    def put(self, session_id: str, token: str, value: str) -> None:
        key = self._key(session_id)
        self._r.hset(key, token, self._crypto.encrypt(value))
        self._r.expire(key, self._ttl)

    def get(self, session_id: str, token: str) -> str | None:
        raw = self._r.hget(self._key(session_id), token)
        return self._crypto.decrypt(raw) if raw is not None else None

    def get_map(self, session_id: str) -> dict[str, str]:
        data = self._r.hgetall(self._key(session_id))
        return {
            k.decode(): self._crypto.decrypt(v) for k, v in data.items()
        }

    def delete_session(self, session_id: str) -> None:
        self._r.delete(self._key(session_id))
