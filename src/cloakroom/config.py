"""Configuration and adapter wiring.

`Settings` is env-driven; the `build_*` factories select which concrete adapter
backs each pluggable layer. This module is the single place that knows about
vendor-specific implementations -- everything else codes against interfaces.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class Settings:
    detector: str = "regex"            # regex | presidio | comprehend (AWS)
    vault: str = "memory"              # memory | redis | dynamodb (AWS)
    llm: str = "mock"                  # mock | ollama | bedrock (AWS)
    mask_strategy: str = "token"       # token | redact | format_preserving | prefix
    prefix_keep: int = 1               # chars kept by the prefix (sortable) strategy
    encryption_key: str | None = None  # base64 Fernet key; generated if None
    vault_ttl_seconds: int = 3600
    redis_url: str = "redis://localhost:6379/0"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    spacy_model: str = "en_core_web_sm"
    # --- AWS adapter settings (only used when an "aws" backend is selected) ---
    aws_region: str = "us-east-1"
    comprehend_language: str = "en"
    dynamo_table: str = "cloakroom-vault"
    bedrock_model_id: str = "anthropic.claude-3-5-haiku-20241022-v1:0"

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            detector=os.getenv("CLOAKROOM_DETECTOR", "regex"),
            vault=os.getenv("CLOAKROOM_VAULT", "memory"),
            llm=os.getenv("CLOAKROOM_LLM", "mock"),
            mask_strategy=os.getenv("CLOAKROOM_MASK_STRATEGY", "token"),
            prefix_keep=int(os.getenv("CLOAKROOM_PREFIX_KEEP", "1")),
            encryption_key=os.getenv("CLOAKROOM_ENCRYPTION_KEY") or None,
            vault_ttl_seconds=int(os.getenv("CLOAKROOM_VAULT_TTL", "3600")),
            redis_url=os.getenv("CLOAKROOM_REDIS_URL", "redis://localhost:6379/0"),
            ollama_url=os.getenv("CLOAKROOM_OLLAMA_URL", "http://localhost:11434"),
            ollama_model=os.getenv("CLOAKROOM_OLLAMA_MODEL", "llama3.2"),
            spacy_model=os.getenv("CLOAKROOM_SPACY_MODEL", "en_core_web_sm"),
            aws_region=os.getenv("CLOAKROOM_AWS_REGION", "us-east-1"),
            comprehend_language=os.getenv("CLOAKROOM_COMPREHEND_LANG", "en"),
            dynamo_table=os.getenv("CLOAKROOM_DYNAMO_TABLE", "cloakroom-vault"),
            bedrock_model_id=os.getenv(
                "CLOAKROOM_BEDROCK_MODEL", "anthropic.claude-3-5-haiku-20241022-v1:0"
            ),
        )


# --- Factories (lazy imports so optional deps are only required when selected) ---

def build_detector(settings: Settings):
    if settings.detector == "presidio":
        from cloakroom.detection.presidio_detector import PresidioDetector

        return PresidioDetector(spacy_model=settings.spacy_model)
    if settings.detector in ("comprehend", "aws"):
        import boto3

        from cloakroom.detection.aws_comprehend_detector import AwsComprehendDetector

        return AwsComprehendDetector(
            pii_client=boto3.client("comprehend", region_name=settings.aws_region),
            phi_client=boto3.client("comprehendmedical", region_name=settings.aws_region),
            language_code=settings.comprehend_language,
        )
    from cloakroom.detection.regex_detector import RegexDetector

    return RegexDetector()


def build_vault(settings: Settings):
    from cloakroom.vault.crypto import Crypto

    crypto = Crypto(settings.encryption_key)
    if settings.vault == "redis":
        from cloakroom.vault.redis_vault import RedisVault

        return RedisVault(crypto, settings.redis_url, settings.vault_ttl_seconds)
    if settings.vault in ("dynamodb", "aws"):
        import boto3

        from cloakroom.vault.aws_vault import DynamoDBVault

        table = boto3.resource("dynamodb", region_name=settings.aws_region).Table(settings.dynamo_table)
        return DynamoDBVault(crypto, table, settings.vault_ttl_seconds)
    from cloakroom.vault.memory_vault import InMemoryVault

    return InMemoryVault(crypto, settings.vault_ttl_seconds)


def build_llm(settings: Settings):
    if settings.llm == "ollama":
        from cloakroom.llm.ollama_llm import OllamaLLM

        return OllamaLLM(settings.ollama_url, settings.ollama_model)
    if settings.llm in ("bedrock", "aws"):
        import boto3

        from cloakroom.llm.bedrock_llm import BedrockLLM

        return BedrockLLM(
            client=boto3.client("bedrock-runtime", region_name=settings.aws_region),
            model_id=settings.bedrock_model_id,
        )
    from cloakroom.llm.mock_llm import MockLLM

    return MockLLM()
