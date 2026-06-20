"""FastAPI service exposing the masking pipeline over HTTP.

This is the language-agnostic entry point: any stack (Node, Java, Go, ...) can
POST a payload and receive a fully de-tokenized, human-readable result, while raw
sensitive values never leave this process unmasked. A single shared pipeline keeps
session token-maps alive in-memory across requests (use the Redis vault for scale).
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from cloakroom.config import Settings
from cloakroom.pipeline import MaskingPipeline

app = FastAPI(title="Cloakroom", version="0.1.0",
              description="Cloud-agnostic PII/PHI/PFI masking middleware for LLMs.")

# Allow the browser playground (any served origin) to call the API directly.
# Override with CLOAKROOM_CORS_ORIGINS="https://app.example.com,https://..." in prod.
_origins = os.getenv("CLOAKROOM_CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _origins == "*" else [o.strip() for o in _origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

_pipeline: MaskingPipeline | None = None


def get_pipeline() -> MaskingPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = MaskingPipeline.from_settings(Settings.from_env())
    return _pipeline


class ProcessRequest(BaseModel):
    payload: Any                       # plain string or arbitrary JSON record
    session_id: str | None = None      # omit to start a fresh session
    context: str | None = None         # e.g. "financial", "medical"
    instruction: str | None = None     # task for the LLM over the masked data
    strategy: str | None = None        # token | redact | format_preserving | prefix


class FlaggedLeakModel(BaseModel):
    text: str
    category: str
    subtype: str


class ProcessResponse(BaseModel):
    output: str                        # final, human-readable (de-tokenized)
    session_id: str
    masked_payload: str                # exactly what was sent to the LLM
    llm_raw_output: str                # LLM output before unmasking
    detected_counts: dict[str, int]
    flagged_leaks: list[FlaggedLeakModel]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/session")
def create_session() -> dict[str, str]:
    return {"session_id": uuid.uuid4().hex}


# --- Prompt-aware masking decision via a hosted free LLM (Groq, open models) ---
# The key lives in the GROQ_API_KEY env var (server-side), so callers never need
# their own. Set CLOAKROOM_GROQ_MODEL to override the model.
GROQ_MODEL = os.getenv("CLOAKROOM_GROQ_MODEL", "llama-3.3-70b-versatile")
_DECIDE_SYSTEM = (
    "You are a privacy filter that prepares text before it is sent to a third-party LLM. "
    "Given a TASK and DATA, find every sensitive value in DATA (names, phone numbers, emails, "
    "postal addresses, government IDs like PAN/Aadhaar/SSN, bank accounts, IFSC/routing, card "
    "numbers, amounts, dates of birth, medical conditions, etc). For each, decide: \"keep\" ONLY "
    "if the value is genuinely required for the TASK to be answerable; \"mask\" otherwise (default "
    "to masking when unsure). Use a short UPPERCASE type like PII_PERSON, PII_EMAIL, PII_PHONE, "
    "PFI_ACCOUNT, PFI_AMOUNT, PFI_CARD, PHI_CONDITION, PII_ADDRESS, PII_ID. "
    "Return STRICT JSON only: {\"items\":[{\"value\":\"<exact substring copied verbatim from "
    "DATA>\",\"type\":\"<TYPE>\",\"action\":\"mask\"|\"keep\",\"reason\":\"<short>\"}]}. "
    "Every value MUST appear verbatim in DATA. Do not invent values. No commentary."
)


class DecideRequest(BaseModel):
    data: str
    prompt: str | None = None


class DecideItem(BaseModel):
    value: str
    type: str = "DATA"
    action: str = "mask"
    reason: str = ""


class DecideResponse(BaseModel):
    items: list[DecideItem]


@app.post("/decide", response_model=DecideResponse)
def decide(req: DecideRequest) -> DecideResponse:
    """Ask a hosted free LLM which values to mask vs keep for the given task.
    The token<->value mapping is built by the caller, so raw values aren't stored here."""
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise HTTPException(503, "GROQ_API_KEY is not configured on the server.")
    body = {
        "model": GROQ_MODEL,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _DECIDE_SYSTEM},
            {"role": "user", "content": f"TASK:\n{req.prompt or '(no task — mask all sensitive values)'}\n\nDATA:\n{req.data}"},
        ],
    }
    request = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
            # Groq sits behind Cloudflare, which blocks the default urllib UA (CF 1010).
            "User-Agent": "Mozilla/5.0 (compatible; Cloakroom/0.1; +https://cloakroom-mu.vercel.app)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as resp:
            payload = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise HTTPException(502, f"LLM provider error {e.code}: {e.read().decode('utf-8', 'ignore')[:200]}")
    except Exception as e:  # noqa: BLE001 - surface a clean message to the client
        raise HTTPException(502, f"LLM call failed: {e}")

    try:
        content = payload["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        raw_items = parsed.get("items", []) if isinstance(parsed, dict) else []
    except (KeyError, IndexError, json.JSONDecodeError):
        raise HTTPException(502, "LLM returned an unexpected response.")

    items: list[DecideItem] = []
    for it in raw_items:
        if not isinstance(it, dict) or not it.get("value"):
            continue
        items.append(DecideItem(
            value=str(it.get("value")),
            type=str(it.get("type", "DATA")),
            action=str(it.get("action", "mask")),
            reason=str(it.get("reason", "")),
        ))
    return DecideResponse(items=items)


class MaskRequest(BaseModel):
    payload: Any                       # plain string or arbitrary JSON record
    session_id: str | None = None
    context: str | None = None
    strategy: str | None = None        # token | redact | format_preserving | prefix


class MaskResponse(BaseModel):
    masked_payload: str                # send THIS to your own LLM
    mapping: dict[str, str]            # placeholder -> real value; unmask locally
    detected_counts: dict[str, int]
    session_id: str


@app.post("/mask", response_model=MaskResponse)
def mask(req: MaskRequest) -> MaskResponse:
    """Mask only. The caller (e.g. the browser extension) sends `masked_payload`
    to its own LLM, then restores real values in the reply using `mapping` —
    so the raw values never touch the model and never persist server-side."""
    session_id = req.session_id or uuid.uuid4().hex
    masked_payload, mapping, counts = get_pipeline().mask(
        req.payload, session_id, context=req.context, strategy=req.strategy,
    )
    return MaskResponse(
        masked_payload=masked_payload, mapping=mapping,
        detected_counts=counts, session_id=session_id,
    )


@app.post("/process", response_model=ProcessResponse)
def process(req: ProcessRequest) -> ProcessResponse:
    session_id = req.session_id or uuid.uuid4().hex
    result = get_pipeline().process(
        req.payload, session_id, context=req.context, instruction=req.instruction,
        strategy=req.strategy,
    )
    return ProcessResponse(
        output=result.output,
        session_id=result.session_id,
        masked_payload=result.masked_payload,
        llm_raw_output=result.llm_raw_output,
        detected_counts=result.detected_counts,
        flagged_leaks=[
            FlaggedLeakModel(text=l.text, category=l.category.value, subtype=l.subtype)
            for l in result.flagged_leaks
        ],
    )


@app.delete("/session/{session_id}")
def delete_session(session_id: str) -> dict[str, str]:
    get_pipeline().purge_session(session_id)
    return {"deleted": session_id}


def main() -> None:  # `cloakroom-serve` console script
    import uvicorn

    uvicorn.run("cloakroom.service.app:app", host="0.0.0.0", port=8000)
