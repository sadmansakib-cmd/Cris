"""
Tests for LLM Provider, Rate Limiting, and Resilient Fallback.
"""

from unittest.mock import MagicMock
from config import AppConfig
from core.llm_provider import (
    RateLimiter,
    ResilientLLMClient,
    BaseProvider,
    ProviderUnavailableError
)


class MockSuccessProvider(BaseProvider):
    def __init__(self, response_text: str):
        self.response_text = response_text

    def generate(self, prompt: str, system_prompt: str = "") -> str:
        return self.response_text


class MockFailingProvider(BaseProvider):
    def generate(self, prompt: str, system_prompt: str = "") -> str:
        raise ProviderUnavailableError("Simulated provider outage")


def test_rate_limiter():
    limiter = RateLimiter(rpm=3, rpd=10)
    assert limiter.can_request() is True

    limiter.record_request()
    limiter.record_request()
    limiter.record_request()
    assert limiter.can_request() is False


def test_fallback_chain_success():
    config = AppConfig(
        provider_fallback_chain=["gemini", "groq"]
    )
    client = ResilientLLMClient(config)

    # Gemini fails, Groq succeeds
    client.providers["gemini"] = MockFailingProvider()
    client.providers["groq"] = MockSuccessProvider("Groq fallback response")

    result = client.generate("Hello")
    assert result == "Groq fallback response"
