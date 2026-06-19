"""Detection layer: structured regex/format recognizers + lexicon + context-awareness."""
from cloakroom.detection.regex_detector import RegexDetector
from cloakroom.models import Category


def test_detects_email():
    spans = RegexDetector().detect("contact me at prachan@example.com please")
    assert any(s.subtype == "email" and s.category == Category.PII for s in spans)


def test_detects_pan():
    spans = RegexDetector().detect("PAN: ABCDE1234F")
    assert any(s.subtype == "pan" and s.text == "ABCDE1234F" for s in spans)


def test_detects_aadhaar_spaced():
    spans = RegexDetector().detect("Aadhaar 1234 5678 9012 on file")
    assert any(s.subtype == "aadhaar" for s in spans)


def test_detects_ifsc():
    spans = RegexDetector().detect("IFSC ICIC0001234 branch")
    assert any(s.subtype == "ifsc" and s.category == Category.PFI for s in spans)


def test_detects_credit_card_luhn_valid():
    spans = RegexDetector().detect("card 4111 1111 1111 1111 expires soon")
    assert any(s.subtype == "card" and s.category == Category.PFI for s in spans)


def test_invalid_luhn_is_not_a_card():
    spans = RegexDetector().detect("number 1234567812345678 here")
    assert all(s.subtype != "card" for s in spans)


def test_detects_phone():
    spans = RegexDetector().detect("call +91 9876543210 now")
    assert any(s.subtype == "phone" and s.category == Category.PII for s in spans)


def test_detects_amount():
    spans = RegexDetector().detect("paid Rs. 1,23,456.78 yesterday")
    assert any(s.subtype == "amount" and s.category == Category.PFI for s in spans)


def test_detects_bank_account_generic():
    spans = RegexDetector().detect("a/c 000123456789011 credited")  # 15 digits
    assert any(s.subtype == "account" and s.category == Category.PFI for s in spans)


def test_person_lexicon():
    spans = RegexDetector(person_names=["Prachan"]).detect("Prachan placed an order")
    assert any(
        s.category == Category.PII and s.subtype == "person" and s.text == "Prachan"
        for s in spans
    )


def test_context_reclassifies_person_as_linked_party():
    spans = RegexDetector(person_names=["Prachan"]).detect(
        "Prachan holds the account", context="financial"
    )
    assert any(s.category == Category.PFI and s.subtype == "linked_party" for s in spans)


def test_medical_condition_default_lexicon():
    spans = RegexDetector().detect("patient diagnosed with diabetes last year")
    assert any(s.category == Category.PHI and s.subtype == "condition" for s in spans)


def test_no_overlapping_spans():
    text = "Prachan ICIC0001234 4111111111111111 prachan@example.com"
    spans = RegexDetector(person_names=["Prachan"]).detect(text, context="financial")
    ordered = sorted(spans, key=lambda s: s.start)
    for a, b in zip(ordered, ordered[1:]):
        assert a.end <= b.start  # no overlaps


def test_spans_text_matches_source_slice():
    text = "PAN ABCDE1234F and mail x@y.com"
    for s in RegexDetector().detect(text):
        assert text[s.start:s.end] == s.text
