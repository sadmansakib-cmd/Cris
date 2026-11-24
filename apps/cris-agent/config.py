"""
Cris Agent - Configuration and Settings
Loaded strictly from environment variables and .env with safe defaults.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional


@dataclass
class VoiceConfig:
    wake_word_phrase: str = "Hey Cris"
    silence_timeout_seconds: int = 20
    whisper_model: str = "base"
    tts_voice_en: str = "en-US-GuyNeural"
    tts_voice_bn: str = "bn-BD-PradeepNeural"
    input_device_index: Optional[int] = None
    output_device_index: Optional[int] = None
    sample_rate: int = 16000


@dataclass
class RateLimitConfig:
    gemini_rpm: int = 15
    gemini_rpd: int = 1500
    retry_max_attempts: int = 4
    retry_initial_delay: float = 1.0
    retry_max_delay: float = 16.0


@dataclass
class AppConfig:
    # Mode: 'pipeline', 'live', or 'text'
    mode: str = "pipeline"
    
    # LLM Settings
    primary_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:latest"
    
    provider_fallback_chain: List[str] = field(default_factory=lambda: ["gemini", "groq", "ollama"])
    
    # Voice Settings
    voice: VoiceConfig = field(default_factory=VoiceConfig)
    
    # Rate Limits
    rate_limits: RateLimitConfig = field(default_factory=RateLimitConfig)
    
    # Security Boundaries
    allowed_roots: List[str] = field(default_factory=lambda: [
        str(Path("d:/halt").resolve()),
        str(Path.home().resolve())
    ])
    
    app_allowlist: List[str] = field(default_factory=lambda: [
        "notepad.exe",
        "calc.exe",
        "code.cmd",
        "chrome.exe",
        "explorer.exe",
        "msedge.exe",
        "mspaint.exe",
        "cmd.exe",
        "powershell.exe"
    ])
    
    kill_switch_hotkey: str = "ctrl+alt+q"
    confirmation_timeout_seconds: int = 30
    
    # Storage Paths (relative to apps/cris-agent unless absolute)
    base_dir: Path = field(default_factory=lambda: Path(__file__).parent.resolve())
    data_dir: Path = field(init=False)
    tokens_dir: Path = field(init=False)
    logs_dir: Path = field(init=False)
    sqlite_db_path: Path = field(init=False)
    browser_profile_dir: Path = field(init=False)
    
    # Integrations
    google_credentials_file: Path = field(init=False)
    google_token_file: Path = field(init=False)
    github_token: str = ""
    github_username: str = ""
    
    def __post_init__(self):
        self.data_dir = self.base_dir / "data"
        self.tokens_dir = self.base_dir / "tokens"
        self.logs_dir = self.base_dir / "logs"
        self.sqlite_db_path = self.data_dir / "cris_memory.db"
        self.browser_profile_dir = self.data_dir / "browser_profile"
        self.google_credentials_file = self.tokens_dir / "google_credentials.json"
        self.google_token_file = self.tokens_dir / "google_token.json"
        
        # Ensure runtime local directories exist
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.tokens_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.browser_profile_dir.mkdir(parents=True, exist_ok=True)

    def is_path_allowed(self, path: Path | str) -> bool:
        """Verify that a path resolves within one of the allowed_roots."""
        try:
            resolved = Path(path).resolve()
            for root in self.allowed_roots:
                root_path = Path(root).resolve()
                if resolved == root_path or root_path in resolved.parents:
                    return True
            return False
        except Exception:
            return False

    def is_app_allowed(self, app_name_or_path: str) -> bool:
        """Check if application executable name is in the allowlist."""
        app_name = Path(app_name_or_path).name.lower()
        return any(app_name == allowed.lower() for allowed in self.app_allowlist)
