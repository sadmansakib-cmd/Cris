"""
Cris Agent - Interactive Web Dashboard & Preview Interface
Provides a live web preview for Cris on http://localhost:8000
Powered solely by standard Python libraries (no external web framework needed).
"""

from __future__ import annotations

import json
import logging
import sys
import threading
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from config import AppConfig
from core.config_loader import load_config
from core.confirmation_gate import ConfirmationGate
from core.kill_switch import KillSwitch
from core.llm_provider import ResilientLLMClient
from core.personality import detect_language, get_system_prompt
from memory.sqlite_store import SQLiteStore
from tools import system_status
from tools.registry import ToolRegistry

logger = logging.getLogger("cris.web_ui")

HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cris Assistant — Live Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --border: #1f293d;
      --cyan: #06b6d4;
      --cyan-glow: rgba(6, 182, 212, 0.25);
      --green: #10b981;
      --red: #ef4444;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(17, 24, 39, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--green);
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 10px var(--green);
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1.5rem;
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 1.5rem;
      flex: 1;
      width: 100%;
    }
    .panel {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
    }
    .panel-title {
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--cyan);
      margin-bottom: 1rem;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 0.875rem;
    }
    .stat-label { color: var(--text-muted); }
    .stat-val { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #fff; }
    
    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    button.btn {
      background: #1e293b;
      color: #fff;
      border: 1px solid #334155;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    button.btn:hover {
      background: #273549;
      border-color: var(--cyan);
      color: var(--cyan);
    }
    button.btn-danger {
      background: rgba(239, 68, 68, 0.1);
      border-color: rgba(239, 68, 68, 0.3);
      color: var(--red);
    }
    button.btn-danger:hover {
      background: var(--red);
      color: #fff;
    }

    /* Chat Section */
    .chat-box {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding-right: 0.5rem;
      max-height: 600px;
      min-height: 400px;
    }
    .msg {
      max-width: 80%;
      padding: 0.85rem 1.15rem;
      border-radius: 12px;
      line-height: 1.5;
      font-size: 0.95rem;
    }
    .msg-user {
      align-self: flex-end;
      background: #0284c7;
      color: #fff;
      border-bottom-right-radius: 2px;
    }
    .msg-assistant {
      align-self: flex-start;
      background: #1e293b;
      border: 1px solid var(--border);
      border-bottom-left-radius: 2px;
    }
    .chat-input-bar {
      margin-top: 1rem;
      display: flex;
      gap: 0.75rem;
    }
    input[type="text"] {
      flex: 1;
      background: #0b1120;
      border: 1px solid var(--border);
      padding: 0.85rem 1.25rem;
      border-radius: 8px;
      color: #fff;
      font-size: 0.95rem;
      outline: none;
      transition: border 0.2s;
    }
    input[type="text"]:focus {
      border-color: var(--cyan);
      box-shadow: 0 0 10px var(--cyan-glow);
    }
    .btn-send {
      background: var(--cyan);
      color: #0b1120;
      font-weight: 700;
      padding: 0.85rem 1.5rem;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-send:hover { opacity: 0.9; }

    @media (max-width: 768px) {
      .container { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">
      <span style="color: var(--cyan);">⚡ CRIS</span> ASSISTANT
    </div>
    <div style="display: flex; align-items: center; gap: 1rem;">
      <a href="http://localhost:5173" target="_blank" style="color: var(--text-muted); font-size: 0.875rem; text-decoration: none;">HAULT Web App ↗</a>
      <div class="status-badge">
        <div class="status-dot"></div>
        <span>Online & Active</span>
      </div>
    </div>
  </header>

  <div class="container">
    <!-- Sidebar Telemetry -->
    <div class="panel">
      <div class="panel-title">System Status</div>
      <div class="stat-row">
        <span class="stat-label">Model</span>
        <span class="stat-val" id="model-val">gemini-flash-lite</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Language</span>
        <span class="stat-val">Bilingual (BN / EN)</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">CPU Usage</span>
        <span class="stat-val" id="cpu-val">...</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">RAM Usage</span>
        <span class="stat-val" id="ram-val">...</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Disk Free</span>
        <span class="stat-val" id="disk-val">...</span>
      </div>

      <div class="panel-title" style="margin-top: 1.5rem;">Quick Commands</div>
      <div class="btn-group">
        <button class="btn" onclick="sendPrompt('আজকের আবহাওয়া কেমন?')">⛅ Weather (বাংলা)</button>
        <button class="btn" onclick="sendPrompt('Give me a daily briefing.')">📋 Daily Briefing</button>
        <button class="btn" onclick="sendPrompt('Check system status')">🖥️ System Telemetry</button>
        <button class="btn" onclick="sendPrompt('Take a screenshot')">📸 Screenshot</button>
        <button class="btn btn-danger" onclick="triggerKillSwitch()">🛑 Kill Switch (Ctrl+Alt+Q)</button>
      </div>
    </div>

    <!-- Main Chat Terminal -->
    <div class="panel" style="display: flex; flex-direction: column;">
      <div class="panel-title">
        <span>Interactive Terminal</span>
        <span style="font-size: 0.75rem; color: var(--text-muted);">Realtime Gemini Bridge</span>
      </div>

      <div class="chat-box" id="chat-box">
        <div class="msg msg-assistant">
          <strong>Cris:</strong> Greetings. I am connected and ready. Speak or type in English or Bengali.
        </div>
      </div>

      <form class="chat-input-bar" onsubmit="handleSend(event)">
        <input type="text" id="user-input" placeholder="Type a message (e.g. 'আজকের আবহাওয়া কেমন?' or 'Build me a timer')..." autocomplete="off" autofocus>
        <button type="submit" class="btn-send" id="send-btn">Send</button>
      </form>
    </div>
  </div>

  <script>
    async function updateStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        document.getElementById('model-val').textContent = data.model || 'Gemini Flash';
        if (data.metrics && data.metrics.disk_c) {
          document.getElementById('disk-val').textContent = data.metrics.disk_c.free_gb + ' GB';
        }
        if (data.metrics && data.metrics.ram) {
          document.getElementById('ram-val').textContent = data.metrics.ram.percent_used + '%';
        }
        if (data.metrics && data.metrics.cpu_percent) {
          document.getElementById('cpu-val').textContent = data.metrics.cpu_percent + '%';
        }
      } catch (e) {
        console.error(e);
      }
    }
    setInterval(updateStatus, 5000);
    updateStatus();

    function appendMessage(text, role) {
      const box = document.getElementById('chat-box');
      const div = document.createElement('div');
      div.className = 'msg ' + (role === 'user' ? 'msg-user' : 'msg-assistant');
      div.innerHTML = (role === 'user' ? '<strong>You:</strong> ' : '<strong>Cris:</strong> ') + text.replace(/\\n/g, '<br>');
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }

    async function sendPrompt(text) {
      if (!text.trim()) return;
      appendMessage(text, 'user');
      const btn = document.getElementById('send-btn');
      btn.disabled = true;
      btn.textContent = '...';

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        appendMessage(data.reply || data.error || 'No response', 'assistant');
      } catch (err) {
        appendMessage('Error communicating with Cris backend: ' + err, 'assistant');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send';
      }
    }

    function handleSend(e) {
      e.preventDefault();
      const input = document.getElementById('user-input');
      const val = input.value.trim();
      if (val) {
        sendPrompt(val);
        input.value = '';
      }
    }

    async function triggerKillSwitch() {
      if (confirm('Trigger emergency abort? All automation will immediately stop.')) {
        await fetch('/api/kill_switch', { method: 'POST' });
        appendMessage('[KILL SWITCH] Emergency abort triggered. Automation halted.', 'assistant');
      }
    }
  </script>
</body>
</html>
"""


class CrisWebHandler(SimpleHTTPRequestHandler):
    config: AppConfig = None
    store: SQLiteStore = None
    llm: ResilientLLMClient = None
    registry: ToolRegistry = None

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))
            return

        elif self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            sys_info = system_status.execute()
            data = {
                "status": "online",
                "model": self.config.gemini_model,
                "metrics": sys_info.get("metrics", {})
            }
            self.wfile.write(json.dumps(data).encode("utf-8"))
            return

        self.send_error(404, "Not Found")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8")

        if self.path == "/api/kill_switch":
            KillSwitch.get_instance().trigger()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "aborted"}).encode("utf-8"))
            return

        elif self.path == "/api/chat":
            try:
                payload = json.loads(body)
                user_msg = payload.get("message", "").strip()
                if not user_msg:
                    self.send_response(400)
                    self.end_headers()
                    return

                # Import main intent execution helper
                from main import execute_potential_tools
                direct = execute_potential_tools(user_msg, self.registry)
                if direct:
                    reply = direct
                else:
                    lang = detect_language(user_msg)
                    facts = self.store.list_facts()
                    facts_str = "\n".join([f"- {f['key']}: {f['value']}" for f in facts]) if facts else ""
                    prompt = get_system_prompt(language=lang, facts_context=facts_str)
                    reply = self.llm.generate(prompt=user_msg, system_prompt=prompt)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"reply": reply}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        self.send_error(404, "Not Found")


def run_server(port: int = 8000):
    config = load_config()
    store = SQLiteStore(config.sqlite_db_path)
    llm = ResilientLLMClient(config)
    gate = ConfirmationGate(timeout_seconds=config.confirmation_timeout_seconds)

    from main import create_tool_registry
    registry = create_tool_registry(gate)

    CrisWebHandler.config = config
    CrisWebHandler.store = store
    CrisWebHandler.llm = llm
    CrisWebHandler.registry = registry

    server = ThreadingHTTPServer(("0.0.0.0", port), CrisWebHandler)
    print(f"\n=======================================================")
    print(f" Cris Live Web Preview running on: http://localhost:{port}")
    print(f"=======================================================\n")
    server.serve_forever()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)
