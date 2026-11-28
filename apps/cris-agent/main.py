"""
Cris Agent - Main Entry Point
Integrates all tools into the ToolRegistry and coordinates text, pipeline, and live modes.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import uuid
from pathlib import Path

from config import AppConfig
from core.config_loader import load_config
from core.confirmation_gate import ConfirmationGate
from core.kill_switch import KillSwitch
from core.llm_provider import ResilientLLMClient, ProviderUnavailableError, RateLimitExceededError
from core.personality import detect_language, get_system_prompt
from core.voice_pipeline import EdgeTTSPlayer, VoiceSession, WhisperSTT
from core.wake_word import WakeWordDetector
from memory.sqlite_store import SQLiteStore
from tools.registry import ToolRegistry

# Tool imports
from tools import (
    open_app,
    window_manager,
    volume_brightness,
    screenshot,
    clipboard,
    system_status,
    keyboard_mouse,
    file_search,
    file_read,
    file_write,
    file_copy,
    file_move,
    file_delete,
    web_search,
    fetch_page,
    weather,
    news,
    notes_tool,
    reminders_tool,
    tasks_tool,
    timers_tool,
    daily_briefing,
    browser_automation,
    email_tool,
    quest_tool,
    image_downloader
)
from integrations.google import calendar_tool, gmail_tool, drive_tool
from integrations.github import github_client
from workflows import deploy_helper, app_builder

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("cris.main")


def create_tool_registry(gate: ConfirmationGate) -> ToolRegistry:
    reg = ToolRegistry(confirmation_gate=gate)
    # Computer & File Tools
    reg.register_module(open_app)
    reg.register_module(window_manager)
    reg.register_module(volume_brightness)
    reg.register_module(screenshot)
    reg.register_module(clipboard)
    reg.register_module(system_status)
    reg.register_module(keyboard_mouse)
    reg.register_module(file_search)
    reg.register_module(file_read)
    reg.register_module(file_write)
    reg.register_module(file_copy)
    reg.register_module(file_move)
    reg.register_module(file_delete)
    # Web & Productivity Tools
    reg.register_module(web_search)
    reg.register_module(fetch_page)
    reg.register_module(weather)
    reg.register_module(news)
    reg.register_module(notes_tool)
    reg.register_module(reminders_tool)
    reg.register_module(tasks_tool)
    reg.register_module(timers_tool)
    reg.register_module(daily_briefing)
    reg.register_module(browser_automation)
    reg.register_module(email_tool)
    reg.register_module(quest_tool)
    reg.register_module(image_downloader)
    # Google & GitHub Integrations
    reg.register_module(calendar_tool)
    reg.register_module(gmail_tool)
    reg.register_module(drive_tool)
    reg.register_module(github_client)
    # Workflows
    reg.register_module(deploy_helper)
    reg.register_module(app_builder)
    return reg


def execute_potential_tools(user_text: str, registry: ToolRegistry) -> Optional[str]:
    """Parse common quick command intents or tool calls."""
    lower = user_text.lower()

    # App builder intent: 'cris, build me <app idea>'
    if "build me" in lower or "create app" in lower:
        idea = re.sub(r"^(cris,?\s*)?(build me|create app)\s*", "", user_text, flags=re.IGNORECASE).strip()
        print(f"\n[App Builder]: Triggered pipeline for idea: '{idea}'")
        res = registry.execute("app_builder", {"app_idea": idea})
        return res.get("message") or res.get("error")

    # Daily briefing intent
    if "daily briefing" in lower or "morning briefing" in lower:
        res = registry.execute("daily_briefing", {})
        return res.get("briefing_text", "")

    # Screenshot intent
    if "take screenshot" in lower or "capture screen" in lower:
        res = registry.execute("screenshot", {})
        return res.get("message") or res.get("error")

    # Quest task assign intent: 'assign a new task...', 'new task...', 'নতুন টাস্ক...'
    if re.search(r"\b(assign\s+(?:a\s+)?(?:new\s+)?task|new\s+task|নতুন\s+টাস্ক|টাস্ক\s+দাও)\b", lower):
        lvl_match = re.search(r"level\s*([1-5])", lower)
        intensity = int(lvl_match.group(1)) if lvl_match else 2
        title_raw = re.sub(r"^(?:cris,?\s*)?(?:assign\s+(?:a\s+)?(?:new\s+)?task|new\s+task|নতুন\s+টাস্ক|টাস্ক\s+দাও)[:\s-]*", "", user_text, flags=re.IGNORECASE)
        clean_title = re.sub(r"level\s*[1-5]", "", title_raw, flags=re.IGNORECASE).strip(" ,.-")
        res = registry.execute("quest_task", {"action": "assign", "title": clean_title or "New Quest", "intensity": intensity})
        return res.get("message") or res.get("error")

    # Quest task complete intent: 'task done', 'task completed', 'mark as done', 'টাস্ক শেষ', 'হয়ে গেছে', 'টিক দাও'
    if re.search(r"\b(task\s+(?:is\s+)?done|task\s+completed|mark\s+task\s+as\s+done|টাস্ক\s+শেষ|হয়ে\s+গেছে|হয়ে\s+গেছে|টিক\s+দাও|টিক\s+মার্ক)\b", lower):
        title_match = re.sub(r"^(?:cris,?\s*)?(?:task\s+(?:is\s+)?done|task\s+completed|mark\s+task\s+as\s+done|টাস্ক\s+শেষ|হয়ে\s+গেছে|হয়ে\s+গেছে|টিক\s+দাও|টিক\s+মার্ক)[:\s-]*", "", user_text, flags=re.IGNORECASE).strip(" ,.-")
        res = registry.execute("quest_task", {"action": "complete", "title": title_match})
        return res.get("message") or res.get("error")

    # Image download intent: 'go to google and download a picture of...', 'download picture of...', 'ছবি ডাউনলোড'
    if re.search(r"\b(download\s+(?:a\s+)?(?:picture|image)|ছবি\s+ডাউনলোড)\b", lower):
        query = re.sub(r"^(?:cris,?\s*)?(?:go\s+to\s+google\s+and\s+)?(?:download\s+(?:a\s+)?(?:picture|image)\s*(?:of)?|ছবি\s+ডাউনলোড\s*(?:করো)?)\s*", "", user_text, flags=re.IGNORECASE).strip(" ,.-")
        res = registry.execute("download_image", {"query": query or "scenery"})
        return res.get("message") or res.get("error")

    # Affirmative approval intent: 'yes', 'হ্যাঁ', 'confirm', 'approve'
    if lower in ("yes", "হ্যাঁ", "confirm", "approve"):
        from core.confirmation_gate import ConfirmationGate
        gate = ConfirmationGate.get_instance()
        pending = gate.list_pending_requests()
        if pending:
            p_req = pending[0]
            gate.resolve_request(p_req["id"], approve=True, source="authenticated_ui")
            if "delete file" in p_req["action"].lower():
                m = re.search(r"'(.*?)'", p_req["action"])
                f_path = m.group(1) if m else ""
                del_tool = registry.get_tool("file_delete")
                if del_tool:
                    res = del_tool.execute_fn(file_path=f_path)
                    return res.get("message") or res.get("error") or f"Action approved and executed: {p_req['action']}"
                return f"Action approved: {p_req['action']}"
            return f"Action approved: {p_req['action']}"

    # Delete file intent: 'go to file manager and delete this file...', 'delete file...'
    if re.search(r"\b(delete\s+(?:this\s+)?file|ফাইল\s+ডিলিট)\b", lower):
        path = re.sub(r"^(?:cris,?\s*)?(?:go\s+to\s+file\s+manager\s+and\s+)?(?:delete\s+(?:this\s+)?file|ফাইল\s+ডিলিট\s*(?:করো)?)\s*", "", user_text, flags=re.IGNORECASE).strip(" '\"")
        from core.confirmation_gate import ConfirmationGate
        gate = ConfirmationGate.get_instance()
        req_id = gate.create_pending_request(f"Delete file '{path or 'target'}' to Recycle Bin")
        return f"[CONFIRMATION REQUIRED] Move '{path or 'target file'}' to the Windows Recycle Bin? Reply 'yes' or click Approve in the Approvals panel."

    # System status intent
    if "system status" in lower or "pc status" in lower or "check cpu" in lower:
        res = registry.execute("system_status", {})
        metrics = res.get("metrics", {})
        return f"System Status: CPU: {metrics.get('cpu_percent')}, RAM: {metrics.get('ram')}, Disk C: {metrics.get('disk_c')}"

    return None


def run_text_chat(config: AppConfig, store: SQLiteStore, llm: ResilientLLMClient, registry: ToolRegistry) -> None:
    session_id = str(uuid.uuid4())[:8]
    print("=" * 65)
    print(f"Cris Agent [Text Mode] - Session ID: {session_id}")
    print(f"Active Model: {config.gemini_model} | Provider: {config.primary_provider}")
    print(f"Registered Tools: {len(registry.tools)} | Kill Switch: {config.kill_switch_hotkey}")
    print("Type your message (or 'exit' / 'quit' to terminate).")
    print("=" * 65)

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

            store.log_message(session_id, "user", user_input)

            # Check if intent directly matches an action
            direct_result = execute_potential_tools(user_input, registry)
            if direct_result:
                print(f"Cris > {direct_result}")
                store.log_message(session_id, "assistant", direct_result)
                continue

            lang = detect_language(user_input)
            system_prompt = get_system_prompt(language=lang, facts_context=facts_str)

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


def run_voice_pipeline(config: AppConfig, store: SQLiteStore, llm: ResilientLLMClient, registry: ToolRegistry) -> None:
    print("=" * 65)
    print("Cris Agent [Voice Pipeline Mode]")
    print(f"Wake Word: '{config.voice.wake_word_phrase}' | Timeout: {config.voice.silence_timeout_seconds}s")
    print(f"Voices: English: {config.voice.tts_voice_en} | Bengali: {config.voice.tts_voice_bn}")
    print("Kill switch: Press Ctrl+Alt+Q to instantly stop automation.")
    print("=" * 65)

    tts = EdgeTTSPlayer(config.voice.tts_voice_en, config.voice.tts_voice_bn)
    voice_session = VoiceSession(config)

    def on_wake():
        print(f"\n[!] Wake word '{config.voice.wake_word_phrase}' detected! Cris is listening...")
        tts.speak("I'm listening.")

    detector = WakeWordDetector(config.voice, on_wake_word_triggered=on_wake)
    detector.start_listening()

    print("[*] Local wake word detector is active. Say 'Hey Cris' or press Enter in console to speak...")
    try:
        # Hybrid interactive loop
        run_text_chat(config, store, llm, registry)
    finally:
        detector.stop_listening()


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

    # Initialize components
    gate = ConfirmationGate(timeout_seconds=config.confirmation_timeout_seconds)
    registry = create_tool_registry(gate)
    store = SQLiteStore(config.sqlite_db_path)
    llm = ResilientLLMClient(config)

    # Start emergency kill switch listener
    kill_switch = KillSwitch.get_instance(config.kill_switch_hotkey)
    kill_switch.start_listener()

    logger.info(f"Initialized Cris Agent in mode: '{config.mode}'")

    if config.mode == "text":
        run_text_chat(config, store, llm, registry)
    elif config.mode == "pipeline":
        run_voice_pipeline(config, store, llm, registry)
    elif config.mode == "live":
        print("[!] Live mode requested. Falling back to pipeline mode if Live SDK not connected.")
        run_voice_pipeline(config, store, llm, registry)


if __name__ == "__main__":
    main()
