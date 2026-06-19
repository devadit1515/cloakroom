"""Unmasker: token restoration + secondary scan for LLM-generated leaks."""
from cloakroom.detection.regex_detector import RegexDetector
from cloakroom.masking.unmasker import Unmasker
from cloakroom.vault.crypto import Crypto
from cloakroom.vault.memory_vault import InMemoryVault


def vault_with(**pairs):
    v = InMemoryVault(Crypto())
    for token, value in pairs.items():
        v.put("s1", token, value)
    return v


def test_restore_replaces_known_tokens():
    v = vault_with(**{"[PII_PERSON_1]": "Prachan", "[PFI_ACCOUNT_1]": "1234567890"})
    out = Unmasker(v).restore("[PII_PERSON_1] holds [PFI_ACCOUNT_1]", "s1")
    assert out == "Prachan holds 1234567890"


def test_restore_leaves_unknown_token_untouched():
    out = Unmasker(InMemoryVault(Crypto())).restore("[PII_PERSON_9]", "s1")
    assert out == "[PII_PERSON_9]"


def test_secondary_scan_flags_raw_value_the_llm_invented():
    u = Unmasker(InMemoryVault(Crypto()), detector=RegexDetector())
    leaks = u.secondary_scan("Note: [PFI_ACCOUNT_1] relates to PAN ABCDE1234F")
    assert any(l.subtype == "pan" and l.text == "ABCDE1234F" for l in leaks)


def test_secondary_scan_ignores_placeholder_tokens():
    u = Unmasker(InMemoryVault(Crypto()), detector=RegexDetector())
    assert u.secondary_scan("[PFI_ACCOUNT_1] and [PII_PERSON_1] only") == []


def test_secondary_scan_without_detector_returns_empty():
    assert Unmasker(InMemoryVault(Crypto())).secondary_scan("PAN ABCDE1234F") == []
