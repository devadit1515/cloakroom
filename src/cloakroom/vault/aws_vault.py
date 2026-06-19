"""AWS vault: token<->value store backed by a DynamoDB table.

The AWS adapter for the vault layer. Values are Fernet-encrypted before they ever
reach DynamoDB (encryption at rest is ours, not just the table's), the table's
native TTL attribute (`expires_at`) auto-expires rows, and we additionally enforce
expiry on read so a not-yet-reaped row is never returned.

Table schema (on-demand billing, TTL enabled on `expires_at`):
    partition key: session_id (S)
    sort key:      token (S)
    attributes:    enc (S, base64 Fernet token), expires_at (N, epoch seconds)

The DynamoDB `Table` resource is injected (built lazily in `config.build_vault`),
so this module never imports boto3 and the tests use an in-memory fake table.
"""
from __future__ import annotations

import time
from typing import Callable

from cloakroom.vault.base import Vault
from cloakroom.vault.crypto import Crypto


class DynamoDBVault(Vault):
    def __init__(
        self,
        crypto: Crypto,
        table,
        ttl_seconds: int = 3600,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._crypto = crypto
        self._table = table
        self._ttl = ttl_seconds
        self._clock = clock

    def put(self, session_id: str, token: str, value: str) -> None:
        self._table.put_item(
            Item={
                "session_id": session_id,
                "token": token,
                "enc": self._crypto.encrypt(value).decode("ascii"),
                "expires_at": int(self._clock() + self._ttl),
            }
        )

    def get(self, session_id: str, token: str) -> str | None:
        resp = self._table.get_item(Key={"session_id": session_id, "token": token})
        item = resp.get("Item")
        if not item or self._expired(item):
            return None
        return self._decrypt(item)

    def get_map(self, session_id: str) -> dict[str, str]:
        resp = self._table.query(
            KeyConditionExpression="session_id = :sid",
            ExpressionAttributeValues={":sid": session_id},
        )
        out: dict[str, str] = {}
        for item in resp.get("Items", []):
            if self._expired(item):
                continue
            out[item["token"]] = self._decrypt(item)
        return out

    def delete_session(self, session_id: str) -> None:
        resp = self._table.query(
            KeyConditionExpression="session_id = :sid",
            ExpressionAttributeValues={":sid": session_id},
        )
        for item in resp.get("Items", []):
            self._table.delete_item(Key={"session_id": session_id, "token": item["token"]})

    def _expired(self, item: dict) -> bool:
        return self._clock() > float(item["expires_at"])

    def _decrypt(self, item: dict) -> str:
        return self._crypto.decrypt(item["enc"].encode("ascii"))
