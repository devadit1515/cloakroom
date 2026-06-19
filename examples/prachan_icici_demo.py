"""End-to-end Cloakroom demo -- the worked example from the problem statement.

Runs with ZERO paid API keys: RegexDetector + encrypted in-memory vault + MockLLM.
Shows the full lifecycle:  detect -> mask -> (LLM over tokens) -> unmask.

Run:  python examples/prachan_icici_demo.py
"""
from __future__ import annotations

import json

from cloakroom.config import Settings
from cloakroom.detection.regex_detector import RegexDetector
from cloakroom.pipeline import MaskingPipeline


def banner(title: str) -> None:
    print("\n" + "=" * 72 + f"\n{title}\n" + "=" * 72)


def main() -> None:
    settings = Settings(detector="regex", vault="memory", llm="mock")
    # In production, names come from Presidio NER or a customer master list; here we
    # seed the demo name so the zero-dependency regex path can recognize it.
    pipeline = MaskingPipeline.from_settings(
        settings, detector=RegexDetector(person_names=["Prachan"])
    )

    record = {
        "customer_name": "Prachan",
        "bank": "ICICI",
        "account_number": "002233445566",
        "ifsc": "ICIC0001234",
        "order_amount": "Rs. 1,45,000.00",
        "note": "Prachan placed an order; previously diagnosed with diabetes.",
    }

    banner("1) ORIGINAL RECORD  (PII + PFI + PHI all present)")
    print(json.dumps(record, indent=2, ensure_ascii=False))

    result = pipeline.process(
        record,
        session_id="demo-session",
        context="financial",
        instruction="Summarize this customer's transaction and flag anything unusual.",
    )

    banner("2) MASKED PAYLOAD ACTUALLY SENT TO THE LLM  (tokens only -- no raw values)")
    print(result.masked_payload)

    banner("3) RAW LLM OUTPUT  (still tokenized -- the model never saw real values)")
    print(result.llm_raw_output)

    banner("4) FINAL OUTPUT SHOWN TO THE END USER  (fully restored / human-readable)")
    print(result.output)

    banner("AUDIT VIEW  (categories/subtypes detected -- counts only, no raw values)")
    print(json.dumps(result.detected_counts, indent=2))
    print("LLM-generated leaks flagged by secondary scan:", result.flagged_leaks)

    # Guarantee the demo actually upholds its promise.
    for raw in ["Prachan", "002233445566", "ICIC0001234", "1,45,000", "diabetes"]:
        assert raw not in result.masked_payload, f"LEAK: '{raw}' reached the LLM!"
    print("\n[OK] No raw PII/PHI/PFI value appeared in the payload sent to the LLM.")


if __name__ == "__main__":
    main()
