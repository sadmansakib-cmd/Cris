"""
Cris Agent - Multi-Provider Resilient LLM Client
Supports Gemini, Groq, and local Ollama with fallback chain, rate limiting, and exponential backoff with jitter.
"""

from __future__ import annotations

import json
import logging
import random
import time
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional
from config import AppConfig

logger = logging.getLogger("cris.llm")


class RateLimitExceededError(Exception):
    """Raised when request counters exceed configured limits."""
    pass


class ProviderUnavailableError(Exception):
    """Raised when an LLM provider model is unavailable or encounters fatal error."""
    pass


class RateLimiter:
    """Sliding window in-memory rate limiter for free tier tracking."""
    def __init__(self, rpm: int = 15, rpd: int = 1500):
        self.rpm = rpm
        self.rpd = rpd
        self._minute_window: List[float] = []
        self._day_window: List[float] = []

    def can_request(self) -> bool:
        now = time.time()
        # Clean minute window
        self._minute_window = [t for t in self._minute_window if now - t < 60]
        # Clean day window
        self._day_window = [t for t in self._day_window if now - t < 86400]
        return len(self._minute_window) < self.rpm and len(self._day_window) < self.rpd

    def record_request(self) -> None:
        now = time.time()
        self._minute_window.append(now)
        self._day_window.append(now)

    def get_stats(self) -> Dict[str, Any]:
        now = time.time()
        self._minute_window = [t for t in self._minute_window if now - t < 60]
        self._day_window = [t for t in self._day_window if now - t < 86400]
        return {
            "current_rpm": len(self._minute_window),
            "max_rpm": self.rpm,
            "current_rpd": len(self._day_window),
            "max_rpd": self.rpd
        }


class BaseProvider:
    def generate(self, prompt: str, system_prompt: str = "", model_override: str = "") -> str:
        raise NotImplementedError


class GeminiProvider(BaseProvider):
    def __init__(self, config: AppConfig):
        self.config = config
        self.api_key = config.gemini_api_key
        self.model = config.gemini_model

    def generate(self, prompt: str, system_prompt: str = "", model_override: str = "") -> str:
        if not self.api_key:
            raise ProviderUnavailableError("Gemini API key is missing. Set GEMINI_API_KEY in .env.")

        target_model = model_override or self.model
        # REST endpoint for Gemini API
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={self.api_key}"

        contents = []
        if system_prompt:
            contents.append({
                "role": "user",
                "parts": [{"text": f"System Instructions: {system_prompt}\n\nPlease confirm understanding briefly."}]
            })
            contents.append({
                "role": "model",
                "parts": [{"text": "Understood. I will follow your instructions."}]
            })

        contents.append({
            "role": "user",
            "parts": [{"text": prompt}]
        })

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 2048
            }
        }

        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                candidates = result.get("candidates", [])
                if not candidates:
                    raise ProviderUnavailableError(f"No response candidates returned by model {target_model}.")
                parts = candidates[0].get("content", {}).get("parts", [])
                text_response = "".join(p.get("text", "") for p in parts)
                return text_response.strip()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                raise
            error_body = e.read().decode("utf-8", errors="ignore")
            raise ProviderUnavailableError(f"Gemini API HTTP {e.code} for model '{target_model}': {error_body}")
        except Exception as e:
            raise ProviderUnavailableError(f"Gemini network error: {e}")


class GroqProvider(BaseProvider):
    def __init__(self, config: AppConfig):
        self.config = config
        self.api_key = config.groq_api_key
        self.model = config.groq_model

    def generate(self, prompt: str, system_prompt: str = "", model_override: str = "") -> str:
        if not self.api_key:
            raise ProviderUnavailableError("Groq API key is missing. Set GROQ_API_KEY in .env.")

        target_model = model_override or self.model
        url = "https://api.groq.com/openai/v1/chat/completions"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": 0.4,
            "max_tokens": 2048
        }

        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result["choices"][0]["message"]["content"].strip()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                raise
            error_body = e.read().decode("utf-8", errors="ignore")
            raise ProviderUnavailableError(f"Groq API HTTP {e.code} for model '{target_model}': {error_body}")
        except Exception as e:
            raise ProviderUnavailableError(f"Groq network error: {e}")


class OllamaProvider(BaseProvider):
    def __init__(self, config: AppConfig):
        self.config = config
        self.base_url = config.ollama_base_url.rstrip("/")
        self.model = config.ollama_model

    def generate(self, prompt: str, system_prompt: str = "", model_override: str = "") -> str:
        target_model = model_override or self.model
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": target_model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False
        }

        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result.get("response", "").strip()
        except Exception as e:
            raise ProviderUnavailableError(f"Local Ollama error at {self.base_url} (model '{target_model}'): {e}")


class ResilientLLMClient:
    """Manages fallback chain and retries with exponential backoff and jitter."""
    def __init__(self, config: AppConfig):
        self.config = config
        self.rate_limiter = RateLimiter(
            rpm=config.rate_limits.gemini_rpm,
            rpd=config.rate_limits.gemini_rpd
        )
        self.providers: Dict[str, BaseProvider] = {
            "gemini": GeminiProvider(config),
            "groq": GroqProvider(config),
            "ollama": OllamaProvider(config)
        }

    def _execute_with_backoff(self, provider: BaseProvider, prompt: str, system_prompt: str, model_override: str = "") -> str:
        attempts = self.config.rate_limits.retry_max_attempts
        delay = self.config.rate_limits.retry_initial_delay
        max_delay = self.config.rate_limits.retry_max_delay

        for attempt in range(1, attempts + 1):
            try:
                try:
                    if model_override:
                        return provider.generate(prompt, system_prompt, model_override=model_override)
                    else:
                        return provider.generate(prompt, system_prompt)
                except TypeError:
                    return provider.generate(prompt, system_prompt)
            except urllib.error.HTTPError as e:
                if e.code in (429, 503) and attempt < attempts:
                    jitter = random.uniform(0.1, 0.5) * delay
                    sleep_time = min(delay + jitter, max_delay)
                    logger.warning(f"HTTP {e.code} received. Retrying in {sleep_time:.2f}s (attempt {attempt}/{attempts})...")
                    time.sleep(sleep_time)
                    delay *= 2.0
                else:
                    raise
            except ProviderUnavailableError:
                raise

        raise ProviderUnavailableError("Exceeded retry attempts.")

    def generate(self, prompt: str, system_prompt: str = "", model_override: str = "") -> str:
        if not self.rate_limiter.can_request():
            raise RateLimitExceededError("Free tier rate limit threshold reached (RPM/RPD). Please wait a moment.")

        errors: List[str] = []

        # Iterate through configured fallback chain
        for provider_name in self.config.provider_fallback_chain:
            provider = self.providers.get(provider_name)
            if not provider:
                continue

            try:
                logger.info(f"Attempting generation with provider: {provider_name}")
                result = self._execute_with_backoff(provider, prompt, system_prompt, model_override=model_override)
                self.rate_limiter.record_request()
                return result
            except Exception as e:
                err_msg = f"[{provider_name} failed: {e}]"
                logger.warning(err_msg)
                errors.append(err_msg)

        all_errors = "; ".join(errors)
        raise ProviderUnavailableError(f"All configured LLM providers failed. Details: {all_errors}")
