"""
Cris Agent - Main Entry Point
Supports text-only chat mode, voice pipeline mode, and live streaming mode.
"""

from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

from config import AppConfig
from core.config_loader import load_config
from core.personality import detect_language, get_system_prompt
from core.llm_provider import ResilientLLMClient, ProviderUnavailableError, RateLimitExceededError
from memory.sqlite_store import SQLiteStore


def run_text_chat(config: AppConfig, store: SQLiteStore, llm: ResilientLLMClient) -> None:
    session_id = str(uuid.uuid4())[:8]
    print("=" * 60)
    print(f"Cris Agent [Text Mode] - Session ID: {session_id}")
    print(f"Active Model: {config.gemini_model} (Primary: {config.primary_provider})")
    print("Type your message (or 'exit' / 'quit' to terminate).")
    print("=" * 60)

    # Fetch existing facts for context
    facts = store.list_facts()
    facts_str = "\n".join([f"- {f['key']}: {f['value']}" for f in facts]) if facts else ""

    while True:
        try:
            user_input = input("\nYou > ").strip()
            if not user_input:
                continue
            if user_input.lower() in ("exit", "quit", "bye", "q"):
                print("Cris > Goodbye.")
                break

            # Log user message
            store.log_message(session_id, "user", user_input)

            # Language detection
            lang = detect_language(user_input)
            system_prompt = get_system_prompt(language=lang, facts_context=facts_str)

            # Generate reply
            try:
                response = llm.generate(prompt=user_input, system_prompt=system_prompt)
            except (RateLimitExceededError, ProviderUnavailableError) as e:
                response = f"[Error]: {e}"
            except Exception as e:
                response = f"[Unexpected Error]: {e}"

            print(f"Cris > {response}")
            store.log_message(session_id, "assistant", response)

        except (KeyboardInterrupt, EOFError):
            print("\nCris > Session terminated.")
            break


def main():
    parser = argparse.ArgumentParser(description="Cris - Local Jarvis-style Windows Assistant")
    parser.add_argument("--mode", choices=["text", "pipeline", "live"], default=None,
                        help="Execution mode (default from config: pipeline)")
    parser.add_argument("--env", type=str, default=None, help="Path to custom .env file")
    args = parser.parse_args()

    # Load configuration
    config = load_config(args.env)
    if args.mode:
        config.mode = args.mode

    # Initialize Memory Store
    store = SQLiteStore(config.sqlite_db_path)

    # Initialize LLM Client
    llm = ResilientLLMClient(config)

    print(f"[*] Initialized Cris Agent in mode: '{config.mode}'")

    if config.mode == "text":
        run_text_chat(config, store, llm)
    elif config.mode == "pipeline":
        print("[!] Voice pipeline mode selected. Starting voice session...")
        # Voice pipeline will be invoked here (Phase 3)
        run_text_chat(config, store, llm)
    elif config.mode == "live":
        print("[!] Voice live mode selected. Starting live session...")
        # Voice live will be invoked here (Phase 3)
        run_text_chat(config, store, llm)


if __name__ == "__main__":
    main()
