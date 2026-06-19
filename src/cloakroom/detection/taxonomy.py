"""Maps neutral entity types to (Category, subtype), with context-aware overrides.

Centralizing the mapping here means every detector backend (regex, Presidio, cloud
DLP) only has to emit a neutral entity type; classification policy lives in one place.
"""
from __future__ import annotations

from cloakroom.models import Category

# entity_type -> (Category, subtype)
ENTITY_MAP: dict[str, tuple[Category, str]] = {
    "PERSON": (Category.PII, "person"),
    "EMAIL": (Category.PII, "email"),
    "PHONE": (Category.PII, "phone"),
    "ADDRESS": (Category.PII, "address"),
    "PAN": (Category.PII, "pan"),
    "AADHAAR": (Category.PII, "aadhaar"),
    "BANK_ACCOUNT": (Category.PFI, "account"),
    "IFSC": (Category.PFI, "ifsc"),
    "CREDIT_CARD": (Category.PFI, "card"),
    "AMOUNT": (Category.PFI, "amount"),
    "MEDICAL_CONDITION": (Category.PHI, "condition"),
    "MEDICATION": (Category.PHI, "medication"),
}


def resolve(entity_type: str, context: str | None = None) -> tuple[Category, str]:
    """Resolve an entity type to (Category, subtype), applying context overrides.

    Example: in a financial record, a person is the *linked party* of an account,
    so PII:person is reclassified as PFI:linked_party.
    """
    category, subtype = ENTITY_MAP[entity_type]
    if context == "financial" and entity_type == "PERSON":
        return Category.PFI, "linked_party"
    return category, subtype


# JSON field-name -> entity type. When masking a record, a field's KEY often carries
# the context the value alone lacks (e.g. value "002233445566" is ambiguous, but key
# "account_number" makes it a bank account, not an Aadhaar). Exact (lowercased) match.
FIELD_HINTS: dict[str, str] = {
    "name": "PERSON", "full_name": "PERSON", "customer_name": "PERSON",
    "customer": "PERSON", "client": "PERSON", "patient": "PERSON", "patient_name": "PERSON",
    "holder": "PERSON", "account_holder": "PERSON", "beneficiary": "PERSON",
    "email": "EMAIL", "email_address": "EMAIL",
    "phone": "PHONE", "mobile": "PHONE", "contact": "PHONE", "phone_number": "PHONE",
    "address": "ADDRESS",
    "pan": "PAN", "pan_number": "PAN",
    "aadhaar": "AADHAAR", "aadhar": "AADHAAR", "uid": "AADHAAR",
    "account": "BANK_ACCOUNT", "account_number": "BANK_ACCOUNT",
    "account_no": "BANK_ACCOUNT", "acct": "BANK_ACCOUNT", "acct_no": "BANK_ACCOUNT",
    "ifsc": "IFSC", "ifsc_code": "IFSC",
    "card": "CREDIT_CARD", "card_number": "CREDIT_CARD",
    "amount": "AMOUNT", "order_amount": "AMOUNT", "transaction_amount": "AMOUNT",
    "balance": "AMOUNT",
    "diagnosis": "MEDICAL_CONDITION", "condition": "MEDICAL_CONDITION",
    "medication": "MEDICATION", "prescription": "MEDICATION",
}


def entity_type_for_field(field: str) -> str | None:
    """Return the entity type implied by a JSON field name, if any."""
    return FIELD_HINTS.get(field.strip().lower())
