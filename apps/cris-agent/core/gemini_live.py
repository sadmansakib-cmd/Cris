"""
Cris Agent - Gemini Live Realtime Audio Mode
Bidirectional realtime streaming via official google-genai SDK.
Handles continuous audio streaming, server events, and tool calling.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable, Dict, Optional
from config import AppConfig
from tools.registry import ToolRegistry

logger = logging.getLogger("cris.live")


class GeminiLiveSession:
    def __init__(self, config: AppConfig, registry: Optional[ToolRegistry] = None):
        self.config = config
        self.registry = registry or ToolRegistry()
        self.api_key = config.gemini_api_key
        # Gemini live model ID from config
        self.model = config.gemini_model or "gemini-2.0-flash-exp"
        self._is_active = False

    async def connect_and_stream(
        self,
        audio_stream_generator: Optional[Any] = None,
        on_audio_received: Optional[Callable[[bytes], None]] = None
    ) -> None:
        """
        Connect to Gemini Live audio session.
        Uses google.genai client if installed.
        """
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required for Gemini Live mode.")

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key, http_options={"api_version": "v1alpha"})
            logger.info(f"Connecting to Gemini Live with model: {self.model}...")

            # Prepare tool definitions
            tools = [types.Tool(function_declarations=self.registry.get_all_declarations())] if self.registry else []

            config = types.LiveConnectConfig(
                response_modalities=[types.LiveServerContentModalities.AUDIO],
                tools=tools
            )

            async with client.aio.live.connect(model=self.model, config=config) as session:
                self._is_active = True
                logger.info("Connected to Gemini Live session. Streaming audio...")

                # Receive task
                async def receive_loop():
                    async for response in session.receive():
                        server_content = response.server_content
                        if server_content is not None:
                            model_turn = server_content.model_turn
                            if model_turn is not None:
                                for part in model_turn.parts:
                                    if part.inline_data and on_audio_received:
                                        on_audio_received(part.inline_data.data)

                        # Handle Tool Calls
                        tool_call = response.tool_call
                        if tool_call is not None:
                            for call in tool_call.function_calls:
                                logger.info(f"[Live Tool Call]: {call.name}({call.args})")
                                result = self.registry.execute(call.name, call.args)
                                await session.send(types.LiveClientToolResponse(
                                    function_responses=[
                                        types.FunctionResponse(
                                            name=call.name,
                                            id=call.id,
                                            response={"result": result}
                                        )
                                    ]
                                ))

                # Send audio task
                async def send_loop():
                    if audio_stream_generator:
                        async for chunk in audio_stream_generator:
                            if not self._is_active:
                                break
                            await session.send(
                                types.LiveClientRealtimeInput(
                                    media_chunks=[types.Blob(data=chunk, mime_type="audio/pcm")]
                                )
                            )

                await asyncio.gather(receive_loop(), send_loop())

        except ImportError:
            logger.warning("google-genai SDK not installed. Live audio mode unavailable without SDK.")
            raise RuntimeError("Package 'google-genai' is required for Gemini Live mode. Install via requirements.txt.")
        except Exception as e:
            logger.error(f"Gemini Live session error: {e}")
            raise
