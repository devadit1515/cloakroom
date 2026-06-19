"""Service layer: FastAPI endpoints via TestClient (in-process, no network)."""
from fastapi.testclient import TestClient

from cloakroom.service.app import app

client = TestClient(app)


def test_healthz():
    assert client.get("/healthz").json() == {"status": "ok"}


def test_create_session_returns_id():
    sid = client.post("/session").json()["session_id"]
    assert isinstance(sid, str) and len(sid) >= 16


def test_process_masks_payload_and_restores_output():
    body = {"payload": "reach me at john@example.com about account 000111222333"}
    data = client.post("/process", json=body).json()
    # masked payload sent to LLM must not contain raw values
    assert "john@example.com" not in data["masked_payload"]
    assert "000111222333" not in data["masked_payload"]
    assert "[PII_EMAIL_1]" in data["masked_payload"]
    # final output restored for the user
    assert "john@example.com" in data["output"]
    assert "000111222333" in data["output"]
    assert data["detected_counts"]


def test_session_persists_tokens_across_requests():
    sid = client.post("/session").json()["session_id"]
    r1 = client.post("/process", json={"payload": "account 000111222333", "session_id": sid}).json()
    r2 = client.post("/process", json={"payload": "account 000111222333 again", "session_id": sid}).json()
    assert "[PFI_ACCOUNT_1]" in r1["masked_payload"]
    assert "[PFI_ACCOUNT_1]" in r2["masked_payload"]  # stable across turns


def test_delete_session():
    sid = client.post("/session").json()["session_id"]
    client.post("/process", json={"payload": "account 000111222333", "session_id": sid})
    assert client.delete(f"/session/{sid}").json() == {"deleted": sid}
