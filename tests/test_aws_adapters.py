"""AWS adapter tests. All boto3 clients/tables are faked, so these run with no AWS
account, no credentials, and without boto3 installed."""
from __future__ import annotations

from cloakroom.detection.aws_comprehend_detector import AwsComprehendDetector
from cloakroom.llm.bedrock_llm import BedrockLLM
from cloakroom.models import Category
from cloakroom.vault.aws_vault import DynamoDBVault
from cloakroom.vault.crypto import Crypto

TEXT = "Prachan Mehta holds account 002233445566 and has diabetes; IFSC ICIC0001234."


class FakePii:
    def detect_pii_entities(self, Text, LanguageCode):
        ents = []
        for needle, typ in [("Prachan Mehta", "NAME"), ("002233445566", "BANK_ACCOUNT_NUMBER")]:
            i = Text.find(needle)
            ents.append({"Type": typ, "BeginOffset": i, "EndOffset": i + len(needle), "Score": 0.99})
        return {"Entities": ents}


class FakePhi:
    def detect_entities_v2(self, Text):
        i = Text.find("diabetes")
        return {"Entities": [{"Category": "MEDICAL_CONDITION", "Text": "diabetes",
                              "BeginOffset": i, "EndOffset": i + len("diabetes"), "Score": 0.97}]}


class FakeTable:
    def __init__(self):
        self.items: dict[tuple[str, str], dict] = {}

    def put_item(self, Item):
        self.items[(Item["session_id"], Item["token"])] = dict(Item)

    def get_item(self, Key):
        it = self.items.get((Key["session_id"], Key["token"]))
        return {"Item": it} if it else {}

    def query(self, KeyConditionExpression, ExpressionAttributeValues):
        sid = ExpressionAttributeValues[":sid"]
        return {"Items": [v for (s, _), v in self.items.items() if s == sid]}

    def delete_item(self, Key):
        self.items.pop((Key["session_id"], Key["token"]), None)


class FakeBedrock:
    def __init__(self):
        self.calls: list[dict] = []

    def converse(self, **kwargs):
        self.calls.append(kwargs)
        return {"output": {"message": {"content": [{"text": "Customer [PII_PERSON_1] looks fine."}]}}}


# --- Comprehend detector -------------------------------------------------------

def _by_subtype(spans):
    return {s.subtype: s for s in spans}


def test_comprehend_maps_pii_and_phi_alone():
    det = AwsComprehendDetector(FakePii(), FakePhi(), supplement=None)
    spans = det.detect(TEXT)
    by = _by_subtype(spans)
    assert by["person"].category is Category.PII and by["person"].text == "Prachan Mehta"
    assert by["account"].category is Category.PFI and by["account"].text == "002233445566"
    assert by["condition"].category is Category.PHI and by["condition"].text == "diabetes"
    assert len(spans) == 3


def test_comprehend_composes_regex_for_india_ids():
    # Comprehend (faked) doesn't know IFSC; the default regex supplement should catch it.
    det = AwsComprehendDetector(FakePii(), FakePhi())  # default supplement = RegexDetector
    subtypes = {s.subtype for s in det.detect(TEXT)}
    assert "ifsc" in subtypes
    assert "person" in subtypes  # still provided by Comprehend


def test_comprehend_applies_context_override():
    det = AwsComprehendDetector(FakePii(), phi_client=None, supplement=None)
    person = _by_subtype(det.detect(TEXT, context="financial"))["linked_party"]
    assert person.category is Category.PFI


# --- DynamoDB vault ------------------------------------------------------------

def test_dynamo_vault_roundtrip_and_encryption():
    table = FakeTable()
    v = DynamoDBVault(Crypto(), table, ttl_seconds=10)
    v.put("s1", "[PII_PERSON_1]", "Prachan Mehta")
    assert v.get("s1", "[PII_PERSON_1]") == "Prachan Mehta"
    # stored value is encrypted at rest, never plaintext
    assert "Prachan" not in table.items[("s1", "[PII_PERSON_1]")]["enc"]


def test_dynamo_vault_session_isolation_and_map():
    v = DynamoDBVault(Crypto(), FakeTable(), ttl_seconds=10)
    v.put("s1", "[PII_PERSON_1]", "Prachan")
    v.put("s1", "[PFI_ACCOUNT_1]", "002233445566")
    v.put("s2", "[PII_PERSON_1]", "Someone Else")
    assert v.get("s2", "[PFI_ACCOUNT_1]") is None
    assert v.get_map("s1") == {"[PII_PERSON_1]": "Prachan", "[PFI_ACCOUNT_1]": "002233445566"}


def test_dynamo_vault_ttl_expiry():
    clock = [1000.0]
    v = DynamoDBVault(Crypto(), FakeTable(), ttl_seconds=10, clock=lambda: clock[0])
    v.put("s1", "[PII_PERSON_1]", "Prachan")
    clock[0] = 1005.0
    assert v.get("s1", "[PII_PERSON_1]") == "Prachan"
    clock[0] = 1020.0
    assert v.get("s1", "[PII_PERSON_1]") is None
    assert v.get_map("s1") == {}


def test_dynamo_vault_delete_session():
    v = DynamoDBVault(Crypto(), FakeTable(), ttl_seconds=100)
    v.put("s1", "[PII_PERSON_1]", "Prachan")
    v.delete_session("s1")
    assert v.get("s1", "[PII_PERSON_1]") is None


# --- Bedrock LLM ---------------------------------------------------------------

def test_bedrock_converse_passes_prompt_and_returns_text():
    client = FakeBedrock()
    llm = BedrockLLM(client, model_id="m1")
    out = llm.complete("SYSTEM RULES", "Summarize [PII_PERSON_1].")
    assert out == "Customer [PII_PERSON_1] looks fine."
    call = client.calls[0]
    assert call["modelId"] == "m1"
    assert call["system"] == [{"text": "SYSTEM RULES"}]
    assert call["messages"][0]["content"][0]["text"] == "Summarize [PII_PERSON_1]."
