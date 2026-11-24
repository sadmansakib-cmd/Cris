"""
Cris Agent - Wake Word Gate
Local openWakeWord listener for 'Hey Cris'.
Audio is strictly analyzed in local RAM and NEVER streamed to any cloud provider until wake word triggers.
"""

from __future__ import annotations

import collections
import logging
import threading
import time
from typing import Callable, Optional
from config import VoiceConfig

logger = logging.getLogger("cris.wakeword")


class WakeWordDetector:
    def __init__(self, config: VoiceConfig, on_wake_word_triggered: Optional[Callable[[], None]] = None):
        self.config = config
        self.on_wake_word_triggered = on_wake_word_triggered
        self.sample_rate = config.sample_rate
        self.phrase = config.wake_word_phrase
        self._is_listening = False
        self._thread: Optional[threading.Thread] = None
        self._oww_model = None

    def initialize_model(self) -> bool:
        """Initialize local openWakeWord model."""
        try:
            import openwakeword
            from openwakeword.model import Model
            # Load default models or custom trained phrase
            self._oww_model = Model()
            logger.info("Local openWakeWord model loaded successfully.")
            return True
        except ImportError:
            logger.info("Optional package 'openwakeword' not installed. Manual activation and keyboard fallback enabled.")
            return False
        except Exception as e:
            logger.warning(f"Could not load openWakeWord model: {e}")
            return False

    def process_audio_chunk(self, audio_chunk_bytes: bytes) -> bool:
        """
        Process a chunk of 16-bit 16kHz mono PCM audio.
        Returns True if wake word threshold is exceeded.
        """
        if self._oww_model is None:
            return False

        try:
            import numpy as np
            audio_array = np.frombuffer(audio_chunk_bytes, dtype=np.int16)
            prediction = self._oww_model.predict(audio_array)
            for model_name, score in prediction.items():
                if score >= 0.5:
                    logger.info(f"Wake word detected: {model_name} (score: {score:.2f})")
                    return True
        except Exception as e:
            logger.debug(f"Wake word chunk inference error: {e}")
        return False

    def start_listening(self) -> None:
        """Start listening loop in background thread."""
        if self._is_listening:
            return
        self._is_listening = True
        self.initialize_model()

        def _listen_loop():
            logger.info(f"[WAKE WORD GATE] Listening locally for '{self.phrase}'...")
            try:
                import sounddevice as sd
                chunk_duration = 0.08  # 80ms chunks (1280 samples at 16kHz)
                chunk_size = int(self.sample_rate * chunk_duration)

                def callback(indata, frames, time_info, status):
                    if status:
                        logger.debug(f"Audio status: {status}")
                    if not self._is_listening:
                        return
                    audio_bytes = bytes(indata)
                    if self.process_audio_chunk(audio_bytes):
                        if self.on_wake_word_triggered:
                            self.on_wake_word_triggered()

                with sd.RawInputStream(
                    samplerate=self.sample_rate,
                    blocksize=chunk_size,
                    device=self.config.input_device_index,
                    channels=1,
                    dtype='int16',
                    callback=callback
                ):
                    while self._is_listening:
                        time.sleep(0.1)

            except Exception as e:
                logger.warning(f"Audio capture unavailable: {e}. Mic streaming disabled.")

        self._thread = threading.Thread(target=_listen_loop, daemon=True)
        self._thread.start()

    def stop_listening(self) -> None:
        self._is_listening = False
