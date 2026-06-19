"""LLM layer: providers must preserve tokens; system prompt must enforce it."""
from cloakroom.llm.base import TOKEN_PRESERVATION_SYSTEM_PROMPT
from cloakroom.llm.mock_llm import MockLLM


def test_mock_preserves_all_tokens_verbatim():
    prompt = "Summarize: [PII_PERSON_1] holds [PFI_ACCOUNT_1] with balance [PFI_AMOUNT_1]."
    out = MockLLM().complete("sys", prompt)
    for tok in ("[PII_PERSON_1]", "[PFI_ACCOUNT_1]", "[PFI_AMOUNT_1]"):
        assert tok in out


def test_mock_handles_no_tokens():
    out = MockLLM().complete("sys", "nothing sensitive here")
    assert isinstance(out, str) and out


def test_system_prompt_enforces_verbatim_preservation():
    up = TOKEN_PRESERVATION_SYSTEM_PROMPT.upper()
    assert "EXACT" in up and "[CATEGORY_SUBTYPE_N]".upper() in up
