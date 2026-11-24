"""
Cris Agent - Configuration Loader
Safely loads environment variables, parses types, and initializes AppConfig.
"""

from __future__ import annotations

import os
from pathlib import Path
from config import AppConfig, VoiceConfig, RateLimitConfig


def _load_env_file(filepath: Path) -> None:
    """Simple parser to load .env key-value pairs without third-party dependencies."""
    if not filepath.exists() or not filepath.is_file():
        return
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass


def load_config(env_file: Path | str | None = None) -> AppConfig:
    """Load configuration from .env and environment variables."""
    base_dir = Path(__file__).parent.parent.resolve()
    
    # Check agent .env first, then root .env as fallback
    if env_file:
        _load_env_file(Path(env_file))
    else:
        agent_env = base_dir / ".env"
        root_env = base_dir.parent.parent / ".env"
        _load_env_file(agent_env)
        _load_env_file(root_env)

    # Voice config
    voice = VoiceConfig(
        wake_word_phrase=os.getenv("CRIS_WAKE_WORD", "Hey Cris"),
        silence_timeout_seconds=int(os.getenv("CRIS_SILENCE_TIMEOUT", "20")),
        whisper_model=os.getenv("CRIS_WHISPER_MODEL", "base"),
        tts_voice_en=os.getenv("CRIS_TTS_VOICE_EN", "en-US-GuyNeural"),
        tts_voice_bn=os.getenv("CRIS_TTS_VOICE_BN", "bn-BD-PradeepNeural"),
        input_device_index=int(os.getenv("CRIS_INPUT_DEVICE_INDEX")) if os.getenv("CRIS_INPUT_DEVICE_INDEX") else None,
        output_device_index=int(os.getenv("CRIS_OUTPUT_DEVICE_INDEX")) if os.getenv("CRIS_OUTPUT_DEVICE_INDEX") else None,
    )

    # Rate limits
    rate_limits = RateLimitConfig(
        gemini_rpm=int(os.getenv("GEMINI_RPM", "15")),
        gemini_rpd=int(os.getenv("GEMINI_RPD", "1500")),
        retry_max_attempts=int(os.getenv("RETRY_MAX_ATTEMPTS", "4")),
        retry_initial_delay=float(os.getenv("RETRY_INITIAL_DELAY", "1.0")),
        retry_max_delay=float(os.getenv("RETRY_MAX_DELAY", "16.0")),
    )

    # Allowed roots parsing
    allowed_roots_raw = os.getenv("ALLOWED_ROOTS", "")
    if allowed_roots_raw:
        allowed_roots = [p.strip() for p in allowed_roots_raw.split(";") if p.strip()]
    else:
        allowed_roots = [
            str(base_dir.parent.parent.resolve()),
            str(Path.home().resolve())
        ]

    # App allowlist parsing
    app_allowlist_raw = os.getenv("APP_ALLOWLIST", "")
    if app_allowlist_raw:
        app_allowlist = [a.strip() for a in app_allowlist_raw.split(";") if a.strip()]
    else:
        app_allowlist = [
            "notepad.exe",
            "calc.exe",
            "code.cmd",
            "chrome.exe",
            "explorer.exe",
            "msedge.exe",
            "mspaint.exe",
            "cmd.exe",
            "powershell.exe"
        ]

    # Provider fallback chain
    chain_raw = os.getenv("PROVIDER_FALLBACK_CHAIN", "gemini,groq,ollama")
    chain = [c.strip().lower() for c in chain_raw.split(",") if c.strip()]

    return AppConfig(
        mode=os.getenv("CRIS_MODE", "pipeline").lower(),
        primary_provider=os.getenv("PRIMARY_PROVIDER", "gemini").lower(),
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        groq_api_key=os.getenv("GROQ_API_KEY", ""),
        groq_model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        ollama_model=os.getenv("OLLAMA_MODEL", "llama3.2:latest"),
        provider_fallback_chain=chain,
        voice=voice,
        rate_limits=rate_limits,
        allowed_roots=allowed_roots,
        app_allowlist=app_allowlist,
        kill_switch_hotkey=os.getenv("KILL_SWITCH_HOTKEY", "ctrl+alt+q"),
        confirmation_timeout_seconds=int(os.getenv("CONFIRMATION_TIMEOUT_SECONDS", "30")),
        base_dir=base_dir,
        github_token=os.getenv("GITHUB_TOKEN", ""),
        github_username=os.getenv("GITHUB_USERNAME", ""),
    )
