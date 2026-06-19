"""AWS LLM provider: Amazon Bedrock via the unified Converse API.

The AWS adapter for the model layer. Converse gives one request/response shape
across Bedrock model families (Claude, Llama, Titan, ...), so swapping `model_id`
is the only change needed to move between models. The same token-preservation
system prompt (see llm/base.py) is passed through unchanged.

The bedrock-runtime client is injected (built lazily in `config.build_llm`); this
module never imports boto3 and the tests use a fake client.
"""
from __future__ import annotations

from cloakroom.llm.base import LLMProvider


class BedrockLLM(LLMProvider):
    def __init__(
        self,
        client,
        model_id: str = "anthropic.claude-3-5-haiku-20241022-v1:0",
        max_tokens: int = 1024,
        temperature: float = 0.0,
    ) -> None:
        self._client = client
        self._model_id = model_id
        self._max_tokens = max_tokens
        self._temperature = temperature

    def complete(self, system: str, prompt: str) -> str:
        resp = self._client.converse(
            modelId=self._model_id,
            system=[{"text": system}],
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": self._max_tokens, "temperature": self._temperature},
        )
        return resp["output"]["message"]["content"][0]["text"]
