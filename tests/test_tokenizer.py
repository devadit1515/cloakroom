"""Tokenizer: session-consistent, deterministic, counter-continuing across turns."""
from cloakroom.masking.tokenizer import Tokenizer
from cloakroom.models import Category, Span
from cloakroom.vault.crypto import Crypto
from cloakroom.vault.memory_vault import InMemoryVault


def vault():
    return InMemoryVault(Crypto())


def span(text, start, cat, sub):
    return Span(start=start, end=start + len(text), text=text, category=cat, subtype=sub)


def test_same_value_gets_same_token():
    t = Tokenizer(vault(), "s1")
    text = "Prachan and Prachan"
    spans = [span("Prachan", 0, Category.PII, "person"),
             span("Prachan", 12, Category.PII, "person")]
    assert t.mask(text, spans).masked_text == "[PII_PERSON_1] and [PII_PERSON_1]"


def test_distinct_values_numbered_in_reading_order():
    t = Tokenizer(vault(), "s1")
    spans = [span("A", 0, Category.PFI, "account"), span("B", 2, Category.PFI, "account")]
    assert t.mask("A B", spans).masked_text == "[PFI_ACCOUNT_1] [PFI_ACCOUNT_2]"


def test_subtype_uppercased_in_token():
    t = Tokenizer(vault(), "s1")
    r = t.mask("x", [span("x", 0, Category.PFI, "linked_party")])
    assert r.masked_text == "[PFI_LINKED_PARTY_1]"


def test_vault_is_populated():
    v = vault()
    Tokenizer(v, "s1").mask("1234567890", [span("1234567890", 0, Category.PFI, "account")])
    assert v.get("s1", "[PFI_ACCOUNT_1]") == "1234567890"


def test_masked_text_has_no_raw_value():
    r = Tokenizer(vault(), "s1").mask(
        "acct 000123456789011 here", [span("000123456789011", 5, Category.PFI, "account")]
    )
    assert "000123456789011" not in r.masked_text


def test_multiturn_reuses_token_across_separate_tokenizers():
    v = vault()
    Tokenizer(v, "s1").mask("Prachan", [span("Prachan", 0, Category.PII, "person")])
    # turn 2: fresh tokenizer (stateless pipeline) must load existing session state
    r = Tokenizer(v, "s1").mask("Prachan again", [span("Prachan", 0, Category.PII, "person")])
    assert r.masked_text == "[PII_PERSON_1] again"


def test_counter_continues_across_turns():
    v = vault()
    Tokenizer(v, "s1").mask("A", [span("A", 0, Category.PFI, "account")])
    r = Tokenizer(v, "s1").mask("B", [span("B", 0, Category.PFI, "account")])
    assert r.masked_text == "[PFI_ACCOUNT_2]"


def test_entries_returned_for_minted_tokens():
    r = Tokenizer(vault(), "s1").mask(
        "Prachan 1234567890",
        [span("Prachan", 0, Category.PII, "person"),
         span("1234567890", 8, Category.PFI, "account")],
    )
    tokens = {e.token for e in r.entries}
    assert tokens == {"[PII_PERSON_1]", "[PFI_ACCOUNT_1]"}
