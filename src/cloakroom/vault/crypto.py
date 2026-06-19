"""Fernet-based encryption helper for vault values at rest."""
from __future__ import annotations

from cryptography.fernet import Fernet


class Crypto:
    """Thin wrapper over Fernet (AES-128-CBC + HMAC). Generates a key if none given."""

    def __init__(self, key: str | bytes | None = None) -> None:
        if key is None:
            key = Fernet.generate_key()
        if isinstance(key, str):
            key = key.encode()
        self._key: bytes = key
        self._fernet = Fernet(key)

    @property
    def key(self) -> str:
        """Base64 key string, suitable for CLOAKROOM_ENCRYPTION_KEY."""
        return self._key.decode()

    def encrypt(self, plaintext: str) -> bytes:
        return self._fernet.encrypt(plaintext.encode("utf-8"))

    def decrypt(self, blob: bytes) -> str:
        return self._fernet.decrypt(blob).decode("utf-8")
