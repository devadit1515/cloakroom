# How Cloakroom Works

Cloakroom sits between your app and any LLM. It swaps sensitive values for
placeholder tokens **before** the model sees them, lets the model reason over the
tokens, then restores the real values in the answer. Raw PII / PHI / PFI never
leaves your environment.

---

## The flow

Every `POST /process` call runs four steps in a single request:

1. **Detect** — find sensitive spans (names, bank accounts, PAN/Aadhaar/IFSC, card numbers, amounts, medical conditions…).
2. **Mask** — replace each span with a **stable token**: `[PFI_ACCOUNT_1]`. Same value → same token, so the relationships in the data survive. The real value is stored **encrypted** in the vault, keyed to a `session_id`.
3. **Reason** — send the masked text to the LLM. It only ever sees tokens.
4. **Unmask** — swap tokens back from the vault, then **re-scan** the output to flag any raw sensitive value the model might have invented.

```
in:      Prachan Mehta holds account 002233445566, paid ₹84,500. Condition: diabetes.
masked:  [PII_PERSON_1] holds account [PFI_ACCOUNT_1], paid [PFI_AMOUNT_1]. Condition: [PHI_CONDITION_1].
         └─ this masked line is the ONLY thing the LLM receives ─┘
out:     real values restored — for you alone.
```

> Note: the free `regex` detector catches IDs, accounts, amounts, etc. Detecting
> **names** needs NER — use the `presidio` or `comprehend` detector for that.

---

## Three swappable layers

"Cloud-agnostic" means the orchestration is fixed, but each layer is an **adapter**
you select with one env var. That single swap point is the whole portability story.

| Layer | Free default | Other options |
|---|---|---|
| **Detector** | `RegexDetector` | Presidio (NER), AWS Comprehend |
| **Vault** | `InMemoryVault` (Fernet-encrypted, TTL) | Redis, AWS DynamoDB |
| **LLM** | `MockLLM` (echoes tokens) | Ollama (local, free), AWS Bedrock |

**Mask strategies** (how a value is replaced) — set per request or via env:

| Strategy | Reversible | Result |
|---|---|---|
| `token` (default) | yes | `[PFI_ACCOUNT_1]` |
| `format_preserving` | yes | fake value, same shape (`ABCDE1234F` → `XQ...`) |
| `redact` | no | `•••••••••` |
| `prefix` | no | keep first char(s), mask rest |

---

## What is AWS for?

**Nothing is required.** Cloakroom runs 100% free out of the box (regex +
in-memory vault + mock LLM). AWS is the **production / scale** path — opt-in per
layer, **env vars only, no code change**:

- **Comprehend / Comprehend Medical** — managed, higher-accuracy PII + PHI detection. No model to host or train.
- **DynamoDB** — a durable, shared token vault with TTL, so tokens stay consistent across many server instances and survive restarts.
- **Bedrock** — hosted LLMs (e.g. Claude) for the reasoning step.

Same idea extends to Azure / GCP later: write an adapter, flip an env var. The
detect → mask → reason → unmask loop never changes.

---

## How to actually use it

### Option A — HTTP service (any language can call it)

```bash
pip install -e .
cloakroom-serve                 # or: uvicorn cloakroom.service.app:app --port 8000
```

```bash
curl -X POST localhost:8000/process -H "Content-Type: application/json" -d '{
  "payload": "Prachan Mehta paid ₹84,500 from account 002233445566.",
  "instruction": "Summarize the transaction.",
  "session_id": "cust-42",
  "strategy": "token"
}'
```

Response:

| Field | Meaning |
|---|---|
| `output` | final, human-readable answer (de-tokenized) |
| `masked_payload` | exactly what the LLM saw (tokens only) |
| `detected_counts` | counts by category/subtype |
| `flagged_leaks` | any raw value found in the model output |

`payload` accepts plain text **or** a JSON record (string leaf values are masked
and the structure is rebuilt).

### Option B — Python SDK (in-process)

```python
from cloakroom.config import Settings
from cloakroom.pipeline import MaskingPipeline

pipe = MaskingPipeline.from_settings(Settings.from_env())
result = pipe.process(
    "Prachan paid ₹84,500.",
    session_id="cust-42",
    instruction="Summarize.",
)
print(result.output)          # de-tokenized answer
print(result.masked_payload)  # what the LLM saw
```

### Switch to AWS (no code change)

```bash
export CLOAKROOM_DETECTOR=comprehend
export CLOAKROOM_VAULT=dynamodb
export CLOAKROOM_LLM=bedrock
export CLOAKROOM_AWS_REGION=us-east-1
pip install boto3              # AWS creds via the standard AWS credential chain
```

---

## Things worth knowing

- One `/process` call does the **full round-trip**, so the in-memory vault is enough for a single instance. Use **Redis / DynamoDB** when you run multiple instances or need tokens to survive restarts.
- Reuse the **same `session_id`** across calls and the same value keeps the same token — multi-turn continuity.
- Vault values are **Fernet-encrypted** with a TTL; they auto-expire.
- **Audit logs record counts only** — never raw values.

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/process` | detect → mask → LLM → unmask |
| POST | `/session` | mint a new session id |
| DELETE | `/session/{id}` | purge a session's vault |
| GET | `/healthz` | health check |

## Environment variables

| Var | Default | Options |
|---|---|---|
| `CLOAKROOM_DETECTOR` | `regex` | `regex`, `presidio`, `comprehend` |
| `CLOAKROOM_VAULT` | `memory` | `memory`, `redis`, `dynamodb` |
| `CLOAKROOM_LLM` | `mock` | `mock`, `ollama`, `bedrock` |
| `CLOAKROOM_MASK_STRATEGY` | `token` | `token`, `format_preserving`, `redact`, `prefix` |
| `CLOAKROOM_ENCRYPTION_KEY` | generated | base64 Fernet key |
| `CLOAKROOM_VAULT_TTL` | `3600` | seconds |
| `CLOAKROOM_REDIS_URL` | `redis://localhost:6379/0` | — |
| `CLOAKROOM_OLLAMA_URL` / `_MODEL` | `localhost:11434` / `llama3.2` | — |
| `CLOAKROOM_AWS_REGION` | `us-east-1` | any region |
| `CLOAKROOM_BEDROCK_MODEL` | Claude Haiku | any Bedrock model id |
