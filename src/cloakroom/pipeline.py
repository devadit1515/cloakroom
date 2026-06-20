"""MaskingPipeline: the cloud-agnostic orchestrator.

detect -> mask/tokenize -> LLM (tokens only) -> secondary scan + unmask.
Works on plain text or JSON records, persists token mappings per session for
multi-turn continuity, and emits a value-free audit record per request.
"""
from __future__ import annotations

import json
from time import perf_counter
from typing import Any

from cloakroom.audit.logger import AuditLogger
from cloakroom.config import Settings, build_detector, build_llm, build_vault
from cloakroom.detection import taxonomy
from cloakroom.detection.base import Detector, dedupe_overlaps
from cloakroom.llm.base import TOKEN_PRESERVATION_SYSTEM_PROMPT, LLMProvider
from cloakroom.masking.strategies import MaskStrategy, TokenStrategy, strategy_from_name
from cloakroom.masking.tokenizer import Tokenizer
from cloakroom.masking.unmasker import Unmasker
from cloakroom.models import ProcessResult, Span, TokenEntry
from cloakroom.vault.base import Vault

_DEFAULT_INSTRUCTION = (
    "Analyze the following customer record. Provide a concise natural-language "
    "summary and flag anything unusual. Refer to entities only by their tokens."
)


class MaskingPipeline:
    def __init__(
        self,
        detector: Detector,
        vault: Vault,
        llm: LLMProvider,
        audit: AuditLogger | None = None,
        llm_name: str = "mock",
        strategy: MaskStrategy | None = None,
    ) -> None:
        self._detector = detector
        self._vault = vault
        self._llm = llm
        self._audit = audit or AuditLogger()
        self._llm_name = llm_name
        self._strategy = strategy or TokenStrategy()
        self._unmasker = Unmasker(vault, detector)

    @classmethod
    def from_settings(
        cls,
        settings: Settings | None = None,
        detector: Detector | None = None,
    ) -> "MaskingPipeline":
        settings = settings or Settings.from_env()
        return cls(
            detector=detector or build_detector(settings),
            vault=build_vault(settings),
            llm=build_llm(settings),
            llm_name=settings.llm,
            strategy=strategy_from_name(settings.mask_strategy, settings.prefix_keep),
        )

    def purge_session(self, session_id: str) -> None:
        """Drop all token mappings for a session (explicit compliance purge)."""
        self._vault.delete_session(session_id)

    def process(
        self,
        payload: Any,
        session_id: str,
        context: str | None = None,
        instruction: str | None = None,
        request_id: str | None = None,
        strategy: MaskStrategy | str | None = None,
    ) -> ProcessResult:
        start = perf_counter()
        effective = (
            strategy_from_name(strategy) if isinstance(strategy, str)
            else strategy or self._strategy
        )
        tokenizer = Tokenizer(self._vault, session_id, effective)

        masked, raw_entries = self._mask_payload(payload, tokenizer, context)
        entries = list({e.token: e for e in raw_entries}.values())  # dedupe by placeholder
        masked_payload = (
            masked if isinstance(masked, str)
            else json.dumps(masked, ensure_ascii=False, indent=2)
        )

        prompt = f"{instruction or _DEFAULT_INSTRUCTION}\n\nRECORD:\n{masked_payload}"
        llm_raw = self._llm.complete(TOKEN_PRESERVATION_SYSTEM_PROMPT, prompt)

        known = {e.token for e in entries}
        flagged = self._unmasker.secondary_scan(llm_raw, context, known_placeholders=known)
        output = self._unmasker.restore(llm_raw, session_id)

        latency_ms = (perf_counter() - start) * 1000
        # Count distinct entities by value so the total is correct for every strategy
        # (one-way strategies can map different values to the same placeholder).
        seen: set[tuple[str, str, str]] = set()
        counts: dict[str, int] = {}
        for e in raw_entries:
            dedup_key = (e.category.value, e.subtype, e.value)
            if dedup_key in seen:
                continue
            seen.add(dedup_key)
            counts[f"{e.category.value}:{e.subtype}"] = counts.get(f"{e.category.value}:{e.subtype}", 0) + 1
        self._audit.record(session_id, request_id, entries, latency_ms, self._llm_name, flagged)

        return ProcessResult(
            output=output,
            session_id=session_id,
            masked_payload=masked_payload,
            llm_raw_output=llm_raw,
            detected_counts=counts,
            flagged_leaks=flagged,
        )

    def mask(
        self,
        payload: Any,
        session_id: str,
        context: str | None = None,
        strategy: MaskStrategy | str | None = None,
    ) -> tuple[str, dict[str, str], dict[str, int]]:
        """Mask only — no LLM, no unmask. Returns the masked text, the
        placeholder->value map, and detected counts. Used by clients (e.g. the
        browser extension) that send the masked text to their own LLM and unmask
        the reply locally with the returned map."""
        effective = (
            strategy_from_name(strategy) if isinstance(strategy, str)
            else strategy or self._strategy
        )
        tokenizer = Tokenizer(self._vault, session_id, effective)
        masked, raw_entries = self._mask_payload(payload, tokenizer, context)
        masked_payload = (
            masked if isinstance(masked, str)
            else json.dumps(masked, ensure_ascii=False, indent=2)
        )
        mapping = {e.token: e.value for e in raw_entries}
        seen: set[tuple[str, str, str]] = set()
        counts: dict[str, int] = {}
        for e in raw_entries:
            dedup_key = (e.category.value, e.subtype, e.value)
            if dedup_key in seen:
                continue
            seen.add(dedup_key)
            ck = f"{e.category.value}:{e.subtype}"
            counts[ck] = counts.get(ck, 0) + 1
        return masked_payload, mapping, counts

    def _mask_payload(
        self, payload: Any, tokenizer: Tokenizer, context: str | None, field: str | None = None
    ) -> tuple[Any, list[TokenEntry]]:
        if isinstance(payload, str):
            spans = self._detector.detect(payload, context)
            spans = self._add_field_hint(spans, payload, field, context)
            res = tokenizer.mask(payload, spans)
            return res.masked_text, res.entries
        if isinstance(payload, dict):
            masked: dict[str, Any] = {}
            entries: list[TokenEntry] = []
            for key, value in payload.items():
                mv, e = self._mask_payload(value, tokenizer, context, field=key)
                masked[key] = mv
                entries.extend(e)
            return masked, entries
        if isinstance(payload, list):
            masked_list: list[Any] = []
            entries = []
            for value in payload:
                mv, e = self._mask_payload(value, tokenizer, context, field=field)
                masked_list.append(mv)
                entries.extend(e)
            return masked_list, entries
        # numbers / bool / None: not sensitive free text -> leave untouched
        return payload, []

    @staticmethod
    def _add_field_hint(
        spans: list[Span], text: str, field: str | None, context: str | None
    ) -> list[Span]:
        """If a JSON key implies a sensitive type, treat the whole value as that type.

        The field-level span (score 0.99) wins ties against ambiguous regex matches,
        e.g. a 12-digit "account_number" is a bank account, not an Aadhaar number.
        """
        if not field or not text.strip():
            return spans
        entity_type = taxonomy.entity_type_for_field(field)
        if entity_type is None:
            return spans
        category, subtype = taxonomy.resolve(entity_type, context)
        field_span = Span(0, len(text), text, category, subtype, score=0.99)
        return dedupe_overlaps(spans + [field_span])
