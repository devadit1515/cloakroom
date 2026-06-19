# Cloakroom

**Cloud-agnostic PII / PHI / PFI masking middleware for LLM calls.**

> **▶ Live demo:** https://cloakroom-mu.vercel.app — paste a record into the playground and watch it get masked, sent to the model as tokens, and restored.

Drop Cloakroom in front of any LLM call and it transparently runs
`detect → mask → LLM → unmask`: sensitive values are replaced with stable
placeholder tokens before the model ever sees them, the model reasons over the
tokens, and real values are restored in the response shown to the end user.

The LLM never receives raw names, account numbers, Aadhaar/PAN, card numbers,
amounts, or medical conditions — only tokens like `[PFI_ACCOUNT_1]`. This keeps
you compliant (HIPAA / PCI-DSS / GDPR / DPDP) while still getting the model's
reasoning over the *structure and relationships* in your data.

Runs end-to-end with **zero paid API keys** (regex detector + encrypted in-memory
vault + a mock LLM, or a free local model via Ollama).

```
              ┌──────────────── MaskingPipeline (orchestrator) ─────────────────┐
 payload ───▶ │ 1.Detect ─▶ 2.Mask/Tokenize ─▶ 3.LLM(tokens) ─▶ 4.Unmask+scan │ ──▶ user
 (text/JSON)  └────┬───────────────┬──────────────────┬──────────────────┬──────┘
                Detector        Tokenizer ──────────▶ Vault ◀──────────  Unmasker
              (interface)    (session-consistent)  (encrypted, TTL)
                                                       ▲
                                          Audit log (counts only, never raw values)
```

## Quickstart

```bash
python -m venv .venv && . .venv/Scripts/activate     # Windows; use bin/activate on *nix
pip install -e ".[dev]"

python examples/prachan_icici_demo.py                # full lifecycle, no API key
pytest                                               # run the test suite
```

### As a library

```python
from cloakroom import MaskingPipeline, Settings

pipeline = MaskingPipeline.from_settings(Settings(detector="regex", vault="memory", llm="mock"))
result = pipeline.process(
    {"customer_name": "Prachan", "account_number": "002233445566", "order_amount": "Rs. 1,45,000"},
    session_id="user-42",
    context="financial",
)
print(result.masked_payload)   # what the LLM saw  -> tokens only
print(result.output)           # what the user sees -> fully restored
print(result.detected_counts)  # {"PFI:linked_party": 1, "PFI:account": 1, "PFI:amount": 1}
```

### As a service (language-agnostic)

```bash
cloakroom-serve                          # or: uvicorn cloakroom.service.app:app --port 8000
bash examples/curl_examples.sh           # POST /process, /session, GET /healthz
```

## How it works

| Layer | Interface | v1 backend(s) | Job |
|-------|-----------|---------------|-----|
| **Detect** | `detection/base.py::Detector` | `RegexDetector` (default), `PresidioDetector` (opt), `AwsComprehendDetector` (AWS) | find sensitive spans, tag `PII/PHI/PFI` + subtype |
| **Mask** | `masking/tokenizer.py::Tokenizer` + `strategies.py` | session-consistent | replace each value via a strategy (token / redact / format-preserving / prefix) |
| **Vault** | `vault/base.py::Vault` | `InMemoryVault` (default), `RedisVault` (opt), `DynamoDBVault` (AWS) | encrypted (Fernet), session-scoped, TTL'd token store |
| **LLM** | `llm/base.py::LLMProvider` | `MockLLM` (default), `OllamaLLM` (opt), `BedrockLLM` (AWS) | runs the task over masked text |
| **Unmask** | `masking/unmasker.py::Unmasker` | — | restore values + secondary scan for model-generated leaks |

Everything is wired by `config.py` from env vars — the single swap point. The
orchestration in `pipeline.py` is identical no matter which adapters are chosen.

### Masking strategies (how a value is replaced — pick per use case)
Set globally with `CLOAKROOM_MASK_STRATEGY`, or per request via the `strategy` field.

| Strategy | Example (`002233445566`) | Reversible | Use case |
|----------|--------------------------|------------|----------|
| `token` (default) | `[PFI_ACCOUNT_1]` | ✅ | LLM round-trip — reason over tokens, restore the answer |
| `redact` | `••••••••••••` | ❌ | drop the value entirely (don't need it back) |
| `format_preserving` | `176515062365` | ✅ | keep shape/length (valid-looking) for format-sensitive pipelines |
| `prefix` (sortable) | `0•••••••••••` | ❌ | anonymized export that still sorts by the leading chars |

`token` and `format_preserving` write to the vault (restorable); `redact` and
`prefix` are one-way but deterministic, so the same value still maps consistently.

### Notable behaviors
- **Context-aware classification.** `context="financial"` reclassifies a person as
  `PFI:linked_party` (the account holder) instead of `PII:person`. For JSON, the
  field *name* supplies context (`account_number` → bank account, resolving the
  12-digit Aadhaar-vs-account ambiguity).
- **Relationship continuity.** Repeated values reuse the same token within a
  session; multi-turn sessions reload state from the vault so tokens stay stable
  across turns.
- **Secondary output scan.** The LLM's output is re-scanned; any raw sensitive
  value the model *generated* (not a token) is flagged in `result.flagged_leaks`.
- **Value-free audit log.** Each request logs category/subtype counts and timing —
  never raw values, so you prove compliance without a second copy of the data.

## Configuration (env vars)

| Var | Default | Options |
|-----|---------|---------|
| `CLOAKROOM_DETECTOR` | `regex` | `regex`, `presidio`, `comprehend` |
| `CLOAKROOM_VAULT` | `memory` | `memory`, `redis`, `dynamodb` |
| `CLOAKROOM_LLM` | `mock` | `mock`, `ollama`, `bedrock` |
| `CLOAKROOM_MASK_STRATEGY` | `token` | `token`, `redact`, `format_preserving`, `prefix` |
| `CLOAKROOM_PREFIX_KEEP` | `1` | leading chars kept by `prefix` |
| `CLOAKROOM_ENCRYPTION_KEY` | *(generated)* | base64 Fernet key |
| `CLOAKROOM_VAULT_TTL` | `3600` | seconds |
| `CLOAKROOM_REDIS_URL` | `redis://localhost:6379/0` | |
| `CLOAKROOM_OLLAMA_URL` / `_MODEL` | `localhost:11434` / `llama3.2` | |
| `CLOAKROOM_AWS_REGION` | `us-east-1` | any AWS region |
| `CLOAKROOM_DYNAMO_TABLE` | `cloakroom-vault` | DynamoDB table name |
| `CLOAKROOM_BEDROCK_MODEL` | `…haiku…` | any Bedrock model id |

Free open-source backends (no paid API):
- **Real NER:** `pip install -e ".[presidio]" && python -m spacy download en_core_web_sm`,
  then `CLOAKROOM_DETECTOR=presidio` (catches free-text names regex can't).
- **Real local LLM:** `CLOAKROOM_LLM=ollama` after `ollama run llama3.2`.
- **Shared vault:** `pip install -e ".[redis]"`, then `CLOAKROOM_VAULT=redis`.

So the whole pipeline runs with genuine NER + a real model and still **zero paid keys**.
The AWS backends (`".[aws]"`) are the optional paid cloud target, off by default.

## AWS adapter (included)

The AWS cloud target is implemented — set the env vars and `pip install -e ".[aws]"`:

```bash
CLOAKROOM_DETECTOR=comprehend   # Amazon Comprehend (PII) + Comprehend Medical (PHI)
CLOAKROOM_VAULT=dynamodb        # DynamoDB table (TTL on `expires_at`), values Fernet-encrypted by us
CLOAKROOM_LLM=bedrock           # Amazon Bedrock via the Converse API
```

- `detection/aws_comprehend_detector.py` maps Comprehend types to the neutral
  taxonomy and *composes* the regex detector so India-specific IDs (PAN/Aadhaar/
  IFSC) Comprehend doesn't know are still caught.
- `vault/aws_vault.py` is a `DynamoDBVault` (table: partition `session_id`, sort
  `token`, native TTL on `expires_at`; we encrypt values before they hit the table).
- `llm/bedrock_llm.py` uses the Converse API, so changing `model_id` is the only
  change to swap models.

Credentials use standard AWS discovery (env vars / `~/.aws/credentials` / IAM role).
Azure AI Language + Key Vault and GCP DLP + Secret Manager follow the same
interface pattern — add a class and register it in the relevant `build_*` factory.

## Layout

```
src/cloakroom/
  config.py  models.py  pipeline.py
  detection/  masking/  vault/  llm/  audit/  service/  client/
tests/        examples/
```

## Status / out of scope (v1)
Interfaces + working backends ship today: the free stack (regex/Presidio · memory/Redis ·
mock/Ollama) **and** the full AWS adapter set (Comprehend · DynamoDB · Bedrock). Azure and
GCP adapters and a false-positive/negative tuning dashboard are intentionally left as
follow-ups (the audit stream already emits the data the dashboard would need). 

hi