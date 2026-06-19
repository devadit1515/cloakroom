#!/usr/bin/env bash
# Cloakroom HTTP service examples. Start the service first:
#   cloakroom-serve            # or: uvicorn cloakroom.service.app:app --port 8000
set -euo pipefail
BASE="${1:-http://localhost:8000}"

echo "== health =="
curl -s "$BASE/healthz"; echo

echo "== process a plain-text payload =="
curl -s -X POST "$BASE/process" -H 'Content-Type: application/json' -d '{
  "payload": "Reach Prachan at prachan@example.com about account 002233445566 (Rs. 1,45,000).",
  "context": "financial",
  "instruction": "Summarize and flag anything unusual."
}'; echo

echo "== process a JSON record (field names give context) =="
curl -s -X POST "$BASE/process" -H 'Content-Type: application/json' -d '{
  "payload": {
    "customer_name": "Prachan",
    "account_number": "002233445566",
    "ifsc": "ICIC0001234",
    "order_amount": "Rs. 1,45,000.00"
  },
  "context": "financial"
}'; echo

echo "== multi-turn: reuse a session so tokens stay stable across calls =="
SID=$(curl -s -X POST "$BASE/session" | python -c 'import sys,json;print(json.load(sys.stdin)["session_id"])')
curl -s -X POST "$BASE/process" -H 'Content-Type: application/json' -d "{\"payload\":\"account 002233445566\",\"session_id\":\"$SID\"}"; echo
curl -s -X POST "$BASE/process" -H 'Content-Type: application/json' -d "{\"payload\":\"that same account 002233445566 again\",\"session_id\":\"$SID\"}"; echo
