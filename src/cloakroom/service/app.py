"""FastAPI service exposing the masking pipeline over HTTP.

This is the language-agnostic entry point: any stack (Node, Java, Go, ...) can
POST a payload and receive a fully de-tokenized, human-readable result, while raw
sensitive values never leave this process unmasked. A single shared pipeline keeps
session token-maps alive in-memory across requests (use the Redis vault for scale).
"""
from __future__ import annotations

import os
import uuid
from typing import Any

from fastapi import FastAPI
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
