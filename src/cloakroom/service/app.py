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


# --- Prompt-aware masking (no LLM sees the data) ----------------------------
# Cloakroom's own detector finds + masks values on this server. A hosted free
# model (Groq, open weights) is shown only the TASK and the list of TYPES found
# (e.g. "PFI_ACCOUNT") to decide which categories to keep -- never the values.
# Key lives in GROQ_API_KEY (server-side).
GROQ_MODEL = os.getenv("CLOAKROOM_GROQ_MODEL", "llama-3.3-70b-versatile")
_TYPE_SYSTEM = (
    "You decide which CATEGORIES of sensitive data must stay visible for a TASK. "
    "You are given a TASK and a list of TYPES (e.g. PFI_ACCOUNT, PII_EMAIL) detected in some data; "
    "you do NOT see the data itself. For each type, choose action 'keep' ONLY if values of that type "
    "are essential to complete the TASK, otherwise 'mask'. "
    "Return STRICT JSON: {\"decisions\":[{\"type\":\"<TYPE>\",\"action\":\"keep\"|\"mask\",\"reason\":\"<short>\"}]}."
)


def _groq_json(system: str, user: str) -> dict:
    """Call Groq chat-completions in JSON mode. Raises HTTPException on failure."""
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise HTTPException(503, "GROQ_API_KEY is not configured on the server.")
    body = {
        "model": GROQ_MODEL,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
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
        return json.loads(payload["choices"][0]["message"]["content"])
    except (KeyError, IndexError, json.JSONDecodeError):
        raise HTTPException(502, "LLM returned an unexpected response.")


class SmartMaskRequest(BaseModel):
    data: str
    prompt: str | None = None


class SmartMaskItem(BaseModel):
    token: str
    value: str
    type: str


class SmartMaskKept(BaseModel):
    type: str
    reason: str = ""


class SmartMaskResponse(BaseModel):
    masked_payload: str
    mapping: dict[str, str]            # token -> value; unmask locally in the browser
    masked: list[SmartMaskItem]
    kept: list[SmartMaskKept]


@app.post("/smart-mask", response_model=SmartMaskResponse)
def smart_mask(req: SmartMaskRequest) -> SmartMaskResponse:
    """Detect + mask here (no LLM sees the data). When a task prompt is given and a
    key is set, Groq picks which detected TYPES to keep -- seeing only the type
    names and the prompt, never the values."""
    from cloakroom.detection.base import dedupe_overlaps
    from cloakroom.masking.strategies import TokenStrategy
    from cloakroom.masking.tokenizer import Tokenizer
    from cloakroom.vault.crypto import Crypto
    from cloakroom.vault.memory_vault import InMemoryVault

    detector = get_pipeline()._detector
    spans = dedupe_overlaps(detector.detect(req.data))

    def type_of(s: Any) -> str:
        return f"{s.category.value}_{s.subtype.upper()}"

    types_present = sorted({type_of(s) for s in spans})
    keep_types: set[str] = set()
    kept_reason: dict[str, str] = {}
    if types_present and req.prompt and os.getenv("GROQ_API_KEY"):
        parsed = _groq_json(_TYPE_SYSTEM, f"TASK:\n{req.prompt}\n\nTYPES FOUND: {', '.join(types_present)}")
        for d in (parsed.get("decisions", []) if isinstance(parsed, dict) else []):
            if isinstance(d, dict) and str(d.get("action")) == "keep" and d.get("type"):
                t = str(d["type"])
                keep_types.add(t)
                kept_reason[t] = str(d.get("reason", ""))

    mask_spans = [s for s in spans if type_of(s) not in keep_types]
    tokenizer = Tokenizer(InMemoryVault(Crypto(None), 600), "smart-" + uuid.uuid4().hex, TokenStrategy())
    res = tokenizer.mask(req.data, mask_spans)

    mapping = {e.token: e.value for e in res.entries}
    masked = [SmartMaskItem(token=e.token, value=e.value, type=f"{e.category.value}_{e.subtype.upper()}") for e in res.entries]
    kept = [SmartMaskKept(type=t, reason=kept_reason.get(t, "")) for t in types_present if t in keep_types]
    return SmartMaskResponse(masked_payload=res.masked_text, mapping=mapping, masked=masked, kept=kept)


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
