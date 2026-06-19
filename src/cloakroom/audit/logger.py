"""Compliance audit logging: records WHAT was masked, never the raw values.

Emitting only category/subtype counts lets you demonstrate compliance without
creating a second copy of the sensitive data in your logs.
"""
from __future__ import annotations

import json
import logging
from collections import Counter

from cloakroom.models import FlaggedLeak, TokenEntry

_logger = logging.getLogger("cloakroom.audit")


class AuditLogger:
    def __init__(self, logger: logging.Logger | None = None) -> None:
        self._log = logger or _logger

    def record(
        self,
        session_id: str,
        request_id: str | None,
        entries: list[TokenEntry],
        latency_ms: float,
        llm_provider: str,
        flagged_leaks: list[FlaggedLeak],
    ) -> dict:
        by_category: Counter[str] = Counter()
        by_subtype: Counter[str] = Counter()
        for e in entries:
            by_category[e.category.value] += 1
            by_subtype[f"{e.category.value}:{e.subtype}"] += 1
        record = {
            "event": "mask_request",
            "session_id": session_id,
            "request_id": request_id,
            "tokens_total": len(entries),
            "counts_by_category": dict(by_category),
            "counts_by_subtype": dict(by_subtype),
            # Only the COUNT of leaks, plus their category/subtype -- never the value.
            "flagged_leaks": len(flagged_leaks),
            "flagged_leak_subtypes": dict(
                Counter(f"{l.category.value}:{l.subtype}" for l in flagged_leaks)
            ),
            "latency_ms": round(latency_ms, 2),
            "llm_provider": llm_provider,
        }
        self._log.info(json.dumps(record))
        return record
