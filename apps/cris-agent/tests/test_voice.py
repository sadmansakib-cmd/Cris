"""
Tests for Voice Subsystem, Device Selection, Wake Word Gate, and TTS routing.
"""

import time
from config import AppConfig, VoiceConfig
from core.audio_devices import list_audio_devices, get_default_device
from core.wake_word import WakeWordDetector
from core.voice_pipeline import EdgeTTSPlayer, VoiceSession
from core.gemini_live import GeminiLiveSession


def test_audio_device_listing():
    devices = list_audio_devices()
    assert "inputs" in devices
    assert "outputs" in devices
    # Default device lookup should not raise exception
    default_dev = get_default_device("input")
    assert default_dev is None or isinstance(default_dev, int)


def test_wake_word_chunk_processing():
    cfg = VoiceConfig()
    detector = WakeWordDetector(cfg)
    # Processing dummy 0-byte chunk before model load returns False safely
    assert detector.process_audio_chunk(b"\x00" * 2560) is False


def test_tts_language_voice_selection():
    tts = EdgeTTSPlayer(voice_en="en-US-GuyNeural", voice_bn="bn-BD-PradeepNeural")
    assert tts.voice_bn == "bn-BD-PradeepNeural"
    assert tts.voice_en == "en-US-GuyNeural"


def test_voice_session_silence_timeout():
    cfg = AppConfig()
    cfg.voice.silence_timeout_seconds = 20
    session = VoiceSession(cfg)

    now = time.time()
    # Within timeout
    assert session.is_silence_timed_out(now - 10) is False
    # Exceeded timeout
    assert session.is_silence_timed_out(now - 25) is True


def test_gemini_live_validation():
    cfg = AppConfig(gemini_api_key="")
    live = GeminiLiveSession(cfg)
    try:
        import asyncio
        asyncio.run(live.connect_and_stream())
        assert False, "Should raise ValueError for missing API key"
    except ValueError as e:
        assert "GEMINI_API_KEY" in str(e)
