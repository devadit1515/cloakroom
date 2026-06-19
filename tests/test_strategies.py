"""Masking-strategy tests: unit behaviour + end-to-end through the pipeline."""
from __future__ import annotations

from cloakroom.config import Settings, build_detector, build_llm, build_vault
from cloakroom.masking.strategies import (
    FormatPreservingStrategy,
    PrefixStrategy,
    RedactStrategy,
    TokenStrategy,
    strategy_from_name,
)
from cloakroom.models import Category
from cloakroom.pipeline import MaskingPipeline

RECORD = {"customer": "Prachan Mehta", "account_number": "002233445566", "order_amount": "Rs. 84,500"}


def _pipeline():
    s = Settings(detector="regex", vault="memory", llm="mock")
    vault = build_vault(s)
    return MaskingPipeline(build_detector(s), vault, build_llm(s)), vault


# --- unit: each strategy's placeholder -----------------------------------------

def test_token_strategy_shape():
    assert TokenStrategy().placeholder("002233445566", Category.PFI, "account", 1) == "[PFI_ACCOUNT_1]"


def test_redact_preserves_length_and_spaces_only():
    out = RedactStrategy().placeholder("Prachan Mehta", Category.PII, "person", 1)
    assert out == "••••••• •••••"
    assert len(out) == len("Prachan Mehta")


def test_format_preserving_keeps_shape_and_is_deterministic():
    fp = FormatPreservingStrategy()
    out = fp.placeholder("ICIC0001234", Category.PFI, "ifsc", 1)
    assert len(out) == len("ICIC0001234")
    assert out[:4].isalpha() and out[:4].isupper()   # letters stay letters
    assert out[4:].isdigit()                          # digits stay digits
    assert out != "ICIC0001234"
    assert out == fp.placeholder("ICIC0001234", Category.PFI, "ifsc", 1)  # deterministic


def test_prefix_keeps_leading_chars_for_sortability():
    out = PrefixStrategy(keep=1).placeholder("Prachan", Category.PII, "person", 1)
    assert out == "P••••••"


def test_strategy_from_name():
    assert strategy_from_name("redact").name == "redact"
    assert strategy_from_name("sortable").name == "prefix"
    assert strategy_from_name(None).name == "token"  # default


# --- end to end through the pipeline -------------------------------------------

def test_token_is_default_and_reversible():
    pipe, _ = _pipeline()
    r = pipe.process(RECORD, "s-token")
    assert "[PII_PERSON_1]" in r.masked_payload
    assert "Prachan Mehta" not in r.masked_payload
    assert "Prachan Mehta" in r.output          # restored in the final answer
    assert r.detected_counts.get("PII:person") == 1


def test_redact_removes_values_and_is_one_way():
    pipe, vault = _pipeline()
    r = pipe.process(RECORD, "s-redact", strategy="redact")
    assert "Prachan Mehta" not in r.masked_payload
    assert "002233445566" not in r.masked_payload
    assert "•" in r.masked_payload
    assert vault.get_map("s-redact") == {}      # nothing stored -> irreversible
    assert r.detected_counts.get("PFI:account") == 1


def test_format_preserving_hides_values_but_is_reversible():
    pipe, vault = _pipeline()
    r = pipe.process(RECORD, "s-fpe", strategy="format_preserving")
    assert "002233445566" not in r.masked_payload
    assert "84,500" not in r.masked_payload      # sensitive digits changed
    assert "," in r.masked_payload               # separators/grouping preserved
    restorable = set(vault.get_map("s-fpe").values())
    assert {"Prachan Mehta", "002233445566"}.issubset(restorable)


def test_prefix_is_sortable_and_hides_the_rest():
    pipe, _ = _pipeline()
    r = pipe.process(RECORD, "s-prefix", strategy="prefix")
    assert "Prachan Mehta" not in r.masked_payload
    assert "P•" in r.masked_payload             # leading char retained for sort order
