"""End-to-end pipeline: detect -> mask -> LLM -> unmask, text + JSON + multi-turn."""
import json

from cloakroom.audit.logger import AuditLogger
from cloakroom.config import Settings
from cloakroom.detection.regex_detector import RegexDetector
from cloakroom.llm.base import LLMProvider
from cloakroom.pipeline import MaskingPipeline
from cloakroom.vault.crypto import Crypto
from cloakroom.vault.memory_vault import InMemoryVault


def build(detector=None):
    settings = Settings(detector="regex", vault="memory", llm="mock")
    return MaskingPipeline.from_settings(
        settings, detector=detector or RegexDetector(person_names=["Prachan"])
    )


def test_text_masked_payload_has_no_raw_values():
    p = build()
    text = "Prachan holds ICICI account 000111222333 with balance Rs. 50000"
    r = p.process(text, "s1", context="financial")
    assert "Prachan" not in r.masked_payload
    assert "000111222333" not in r.masked_payload
    assert "[PFI_ACCOUNT_1]" in r.masked_payload


def test_text_output_is_restored_for_user():
    p = build()
    text = "Prachan holds account 000111222333"
    r = p.process(text, "s1b", context="financial")
    # MockLLM echoes tokens; restoration brings the real values back to the user
    assert "Prachan" in r.output
    assert "000111222333" in r.output


def test_json_record_roundtrip():
    p = build()
    record = {
        "name": "Prachan",
        "bank": "ICICI",
        "account": "000111222333",
        "amount": "Rs. 50000",
    }
    r = p.process(record, "s2", context="financial")
    assert "Prachan" not in r.masked_payload
    assert "000111222333" not in r.masked_payload
    assert "000111222333" in r.output  # restored to the user


def test_detected_counts_populated():
    p = build()
    r = p.process("Prachan account 000111222333 Rs. 50000", "s3", context="financial")
    assert r.detected_counts.get("PFI:account") == 1
    assert sum(r.detected_counts.values()) >= 2


def test_multiturn_keeps_stable_tokens():
    p = build()
    r1 = p.process("Prachan and account 000111222333", "sess", context="financial")
    r2 = p.process("Prachan placed another order", "sess", context="financial")
    assert "[PFI_LINKED_PARTY_1]" in r1.masked_payload
    assert "[PFI_LINKED_PARTY_1]" in r2.masked_payload  # same token across turns


def test_secondary_scan_flags_llm_generated_leak():
    class LeakyLLM(LLMProvider):
        def complete(self, system, prompt):
            return prompt + "\nAdditionally, related PAN is ABCDE1234F."

    vault = InMemoryVault(Crypto())
    p = MaskingPipeline(RegexDetector(person_names=["Prachan"]), vault, LeakyLLM(), llm_name="leaky")
    r = p.process("Prachan account 000111222333", "s4", context="financial")
    assert any(l.subtype == "pan" for l in r.flagged_leaks)


def test_audit_record_contains_no_raw_values():
    captured = []

    class CapturingAudit(AuditLogger):
        def record(self, *args, **kwargs):
            rec = super().record(*args, **kwargs)
            captured.append(rec)
            return rec

    settings = Settings(detector="regex", vault="memory", llm="mock")
    p = MaskingPipeline.from_settings(settings, detector=RegexDetector(person_names=["Prachan"]))
    p._audit = CapturingAudit()
    p.process("Prachan account 000111222333 Rs. 50000", "s5", context="financial")
    blob = json.dumps(captured[0])
    assert "Prachan" not in blob
    assert "000111222333" not in blob
    assert captured[0]["counts_by_subtype"]  # but counts ARE present


def test_json_field_name_resolves_account_vs_aadhaar():
    # A bare 12-digit value is ambiguous, but the field name "account_number"
    # makes it a bank account (PFI), not an Aadhaar (PII).
    p = build()
    r = p.process({"account_number": "002233445566"}, "sfield", context="financial")
    assert r.detected_counts.get("PFI:account") == 1
    assert "PII:aadhaar" not in r.detected_counts
    assert "002233445566" not in r.masked_payload


def test_json_field_name_marks_customer_name_as_linked_party():
    p = build()
    r = p.process({"customer_name": "Someone Unknown"}, "sfield2", context="financial")
    # caught via field name even though not in the person lexicon
    assert r.detected_counts.get("PFI:linked_party") == 1
