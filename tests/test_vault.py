"""Vault layer: encryption, TTL, session isolation."""
import time

from cloakroom.vault.crypto import Crypto
from cloakroom.vault.memory_vault import InMemoryVault


def make_vault(ttl=3600, clock=None):
    return InMemoryVault(Crypto(), ttl_seconds=ttl, clock=clock or time.time)


def test_put_get_roundtrip():
    v = make_vault()
    v.put("s1", "[PII_PERSON_1]", "Prachan")
    assert v.get("s1", "[PII_PERSON_1]") == "Prachan"


def test_missing_token_returns_none():
    v = make_vault()
    assert v.get("s1", "[NOPE_1]") is None


def test_session_isolation():
    v = make_vault()
    v.put("s1", "[PII_PERSON_1]", "Prachan")
    assert v.get("s2", "[PII_PERSON_1]") is None


def test_get_map_returns_all_decrypted():
    v = make_vault()
    v.put("s1", "[PII_PERSON_1]", "Prachan")
    v.put("s1", "[PFI_ACCOUNT_1]", "1234567890")
    assert v.get_map("s1") == {
        "[PII_PERSON_1]": "Prachan",
        "[PFI_ACCOUNT_1]": "1234567890",
    }


def test_values_are_encrypted_at_rest():
    crypto = Crypto()
    v = InMemoryVault(crypto, ttl_seconds=3600)
    v.put("s1", "[PFI_ACCOUNT_1]", "1234567890")
    raw = v._store["s1"]["[PFI_ACCOUNT_1]"][0]
    assert b"1234567890" not in raw  # plaintext must not be stored


def test_ttl_expiry():
    now = {"t": 1000.0}
    v = make_vault(ttl=60, clock=lambda: now["t"])
    v.put("s1", "[PII_PERSON_1]", "Prachan")
    now["t"] = 1059.0
    assert v.get("s1", "[PII_PERSON_1]") == "Prachan"  # still valid
    now["t"] = 1061.0
    assert v.get("s1", "[PII_PERSON_1]") is None  # expired


def test_delete_session():
    v = make_vault()
    v.put("s1", "[PII_PERSON_1]", "Prachan")
    v.delete_session("s1")
    assert v.get("s1", "[PII_PERSON_1]") is None


def test_crypto_roundtrip_and_key_reuse():
    c = Crypto()
    blob = c.encrypt("secret")
    assert c.decrypt(blob) == "secret"
    c2 = Crypto(c.key)  # same key reconstructs
    assert c2.decrypt(blob) == "secret"
