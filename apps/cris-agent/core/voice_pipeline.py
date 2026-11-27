"""
Cris Agent - Voice Pipeline
Coordinates: openWakeWord -> faster-whisper (local STT) -> Gemini -> edge-tts (TTS)
Multilingual support: Automatically detects Bengali (bn) vs English (en) and routes to native voices.
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import tempfile
import time
import winsound
from pathlib import Path
from typing import Optional, Tuple

from config import AppConfig
from core.personality import detect_language

logger = logging.getLogger("cris.voice")


class WhisperSTT:
    """Local multilingual speech-to-text with faster-whisper."""
    def __init__(self, model_size: str = "base"):
        self.model_size = model_size
        self._model = None

    def _ensure_model(self):
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                logger.info(f"Loading faster-whisper model '{self.model_size}'...")
                self._model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
            except ImportError:
                logger.warning("Optional package 'faster-whisper' not installed.")
                raise

    def transcribe(self, audio_path_or_buffer: str | io.BytesIO) -> Tuple[str, str]:
        """
        Transcribe audio and return (text, detected_language).
        Detected language code: 'en', 'bn', etc.
        """
        self._ensure_model()
        segments, info = self._model.transcribe(audio_path_or_buffer, beam_size=5)
        text = " ".join([seg.text.strip() for seg in segments]).strip()
        detected_lang = info.language or "en"
        return text, detected_lang


class EdgeTTSPlayer:
    """Natural edge-tts voice synthesizer with Bengali and English native neural voices."""
    def __init__(self, voice_en: str = "en-US-GuyNeural", voice_bn: str = "bn-BD-PradeepNeural"):
        self.voice_en = voice_en
        self.voice_bn = voice_bn

    async def _synthesize_to_file(self, text: str, voice: str, out_path: str) -> None:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(out_path)

    def speak(self, text: str, language: Optional[str] = None) -> bool:
        if not text.strip():
            return False

        # Language detection if not provided
        lang = language or detect_language(text)
        voice = self.voice_bn if lang == "bn" else self.voice_en

        logger.info(f"Speaking with voice '{voice}' [Lang: {lang}]: {text[:80]}...")

        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_mp3:
                mp3_path = tmp_mp3.name

            # Run edge-tts asynchronously
            asyncio.run(self._synthesize_to_file(text, voice, mp3_path))

            # Play audio using safe subprocess without shell=True or os.system
            import subprocess
            subprocess.run(["cmd.exe", "/c", "start", "/min", "wmplayer", mp3_path], check=False)

            # Clean up after brief delay in background thread
            def _cleanup():
                time.sleep(10)
                try:
                    os.remove(mp3_path)
                except Exception:
                    pass

            import threading
            threading.Thread(target=_cleanup, daemon=True).start()
            return True

        except ImportError:
            logger.info(f"[TTS Fallback Console]: {text}")
            return False
        except Exception as e:
            logger.warning(f"TTS playback error: {e}")
            return False


class VoiceSession:
    """Manages an active conversational voice turn with silence detection."""
    def __init__(self, config: AppConfig):
        self.config = config
        self.silence_timeout = config.voice.silence_timeout_seconds
        self.stt = WhisperSTT(config.voice.whisper_model)
        self.tts = EdgeTTSPlayer(config.voice.tts_voice_en, config.voice.tts_voice_bn)

    def is_silence_timed_out(self, last_speech_timestamp: float) -> bool:
        """Check if silence threshold has been exceeded."""
        return (time.time() - last_speech_timestamp) > self.silence_timeout
