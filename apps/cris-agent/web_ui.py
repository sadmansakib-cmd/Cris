"""
Cris Agent - Holographic Arc Reactor Web Dashboard & Voice Interface
Interactive holographic UI inspired by Iron Man's Arc Reactor HUD:
- Constantly rotating in IDLE state.
- Stabilizes / locks into focus when LISTENING to voice.
- Beats / pulses vigorously when Cris is SPEAKING.
- Minimalist cinematic aesthetic with full backend tool integration.
"""

from __future__ import annotations

import json
import logging
import sys
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
  <title>CRIS — Quantum Core HUD</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #030407;
      --gold: #ff9e1f;
      --gold-bright: #ffbe4a;
      --gold-dim: #9a5b09;
      --gold-glow: rgba(255, 158, 31, 0.45);
      --gold-soft: rgba(255, 158, 31, 0.12);
      --red: #ef4444;
      --font-mono: 'JetBrains Mono', monospace;
      --font-sans: 'Inter', sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body {
      background: var(--bg);
      color: #fff;
      font-family: var(--font-mono);
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      position: relative;
    }

    /* Ambient Background Radial Vignette */
    .bg-vignette {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(255, 136, 0, 0.08) 0%, rgba(3, 4, 7, 0.95) 70%, #030407 100%);
      pointer-events: none;
      z-index: 1;
    }

    /* Sci-Fi HUD Corner Brackets & Lines */
    .hud-frame {
      position: absolute;
      inset: 20px;
      pointer-events: none;
      z-index: 10;
      border: 1px solid rgba(255, 158, 31, 0.15);
    }
    .hud-corner {
      position: absolute;
      width: 28px;
      height: 28px;
      border-color: var(--gold);
      border-style: solid;
    }
    .top-left { top: -2px; left: -2px; border-width: 3px 0 0 3px; }
    .top-right { top: -2px; right: -2px; border-width: 3px 3px 0 0; }
    .bottom-left { bottom: -2px; left: -2px; border-width: 0 0 3px 3px; }
    .bottom-right { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; }

    /* Top HUD Telemetry Bar */
    header {
      width: 100%;
      padding: 1.5rem 2.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 20;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.1rem;
      letter-spacing: 0.2em;
      color: var(--gold-bright);
      text-shadow: 0 0 12px var(--gold-glow);
    }
    .sys-stats {
      display: flex;
      gap: 2rem;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
      letter-spacing: 0.1em;
    }
    .sys-item span {
      color: var(--gold-bright);
      font-weight: 600;
    }

    /* Center Stage: Canvas & Core */
    .core-container {
      position: relative;
      width: min(72vh, 620px);
      height: min(72vh, 620px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
    }
    canvas#arc-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    /* Interactive Center Touchpoint */
    .core-center-btn {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 174, 43, 0.25) 0%, rgba(255, 115, 0, 0.05) 70%, transparent 100%);
      border: 1px dashed rgba(255, 158, 31, 0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 0 25px rgba(255, 140, 0, 0.15);
    }
    .core-center-btn:hover {
      border-color: var(--gold-bright);
      box-shadow: 0 0 40px var(--gold-glow);
      transform: scale(1.04);
    }
    .core-center-btn:active {
      transform: scale(0.96);
    }
    .status-text {
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.25em;
      color: var(--gold-bright);
      text-shadow: 0 0 10px var(--gold-glow);
      transition: color 0.3s;
    }
    .mic-icon {
      margin-bottom: 0.35rem;
      width: 22px;
      height: 22px;
      stroke: var(--gold-bright);
      fill: none;
      stroke-width: 2;
    }

    /* Dynamic Subtitle / Capsule Display (Minimalist) */
    .capsule-wrapper {
      position: absolute;
      bottom: 110px;
      width: 100%;
      max-width: 680px;
      padding: 0 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 20;
    }
    .capsule {
      background: rgba(15, 20, 30, 0.75);
      border: 1px solid rgba(255, 158, 31, 0.3);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(255, 158, 31, 0.15);
      backdrop-filter: blur(12px);
      border-radius: 9999px;
      padding: 0.75rem 1.75rem;
      font-size: 0.95rem;
      font-family: var(--font-sans);
      color: #fff;
      text-align: center;
      min-width: 280px;
      max-width: 100%;
      transition: all 0.4s ease;
      line-height: 1.5;
    }
    .capsule.speaking {
      border-color: var(--gold-bright);
      box-shadow: 0 0 25px var(--gold-glow);
    }

    /* Bottom Input & Kill Switch Bar */
    footer {
      width: 100%;
      max-width: 760px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      z-index: 20;
    }
    .input-pill {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-pill input {
      width: 100%;
      background: rgba(18, 22, 33, 0.85);
      border: 1px solid rgba(255, 158, 31, 0.25);
      padding: 0.9rem 3.5rem 0.9rem 1.5rem;
      border-radius: 9999px;
      color: #fff;
      font-size: 0.95rem;
      font-family: var(--font-sans);
      outline: none;
      transition: all 0.3s;
    }
    .input-pill input:focus {
      border-color: var(--gold);
      box-shadow: 0 0 20px var(--gold-glow);
      background: rgba(22, 28, 42, 0.95);
    }
    .btn-action-icon {
      position: absolute;
      right: 8px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--gold);
      border: none;
      color: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-weight: 700;
      transition: transform 0.2s, background 0.2s;
    }
    .btn-action-icon:hover {
      background: var(--gold-bright);
      transform: scale(1.08);
    }

    /* Kill switch floating button */
    .btn-kill {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: var(--red);
      font-size: 0.75rem;
      font-family: var(--font-mono);
      font-weight: 600;
      padding: 0.9rem 1.25rem;
      border-radius: 9999px;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .btn-kill:hover {
      background: var(--red);
      color: #fff;
      box-shadow: 0 0 15px rgba(239, 68, 68, 0.5);
    }
  </style>
</head>
<body>
  <div class="bg-vignette"></div>

  <!-- HUD Framing -->
  <div class="hud-frame">
    <div class="hud-corner top-left"></div>
    <div class="hud-corner top-right"></div>
    <div class="hud-corner bottom-left"></div>
    <div class="hud-corner bottom-right"></div>
  </div>

  <!-- Top Telemetry -->
  <header>
    <div class="brand">
      <span>●</span> CRIS // CORE
    </div>
    <div class="sys-stats">
      <div class="sys-item">MODEL: <span id="model-id">FLASH</span></div>
      <div class="sys-item">CPU: <span id="cpu-stat">--%</span></div>
      <div class="sys-item">RAM: <span id="ram-stat">--%</span></div>
      <div class="sys-item">HOTKEY: <span>CTRL+ALT+Q</span></div>
    </div>
  </header>

  <!-- Central Arc Reactor Stage -->
  <div class="core-container">
    <canvas id="arc-canvas"></canvas>
    <div class="core-center-btn" id="core-btn" onclick="toggleVoiceInput()">
      <svg class="mic-icon" id="mic-svg" viewBox="0 0 24 24">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" x2="12" y1="19" y2="22"/>
      </svg>
      <div class="status-text" id="core-status">STANDBY</div>
    </div>
  </div>

  <!-- Minimal Subtitle / Response Capsule -->
  <div class="capsule-wrapper">
    <div class="capsule" id="response-capsule">
      "Say 'Hey Cris' or click core to talk in Bangla or English."
    </div>
  </div>

  <!-- Bottom Command Input -->
  <footer>
    <form class="input-pill" onsubmit="handleSend(event)">
      <input type="text" id="cmd-input" placeholder="Voice ready... or enter natural command (e.g. 'আজকের আবহাওয়া কেমন?')" autocomplete="off">
      <button type="submit" class="btn-action-icon">➔</button>
    </form>
    <button class="btn-kill" onclick="triggerKillSwitch()">ABORT [Q]</button>
  </footer>

  <script>
    /* -------------------------------------------------------------
       Holographic Arc Reactor Canvas Animation
       State:
       - 'idle': continuous smooth rotation (multi-ring opposing speeds)
       - 'listening': rings lock in alignment, stabilizing rotation
       - 'speaking': vigorous audio beat / pulsing shockwaves
       ------------------------------------------------------------- */
    const canvas = document.getElementById('arc-canvas');
    const ctx = canvas.getContext('2d');
    let W, H, CX, CY, R;

    let currentState = 'idle'; // 'idle' | 'listening' | 'speaking'
    let angle1 = 0, angle2 = 0, angle3 = 0;
    let pulseScale = 1.0;
    let beatTime = 0;

    // Golden Arc Particles
    const particles = [];
    const NUM_PARTICLES = 140;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      W = rect.width;
      H = rect.height;
      CX = W / 2;
      CY = H / 2;
      R = Math.min(W, H) * 0.44;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Particle initialization
    for (let i = 0; i < NUM_PARTICLES; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radiusRatio: 0.35 + Math.random() * 0.6,
        speed: (0.003 + Math.random() * 0.008) * (Math.random() > 0.5 ? 1 : -1),
        size: 1 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.7
      });
    }

    function drawArcReactor() {
      ctx.clearRect(0, 0, W, H);

      // State Dynamics
      let rotSpeed1, rotSpeed2, rotSpeed3;
      if (currentState === 'listening') {
        // Stabilize: slow down to nearly static lock
        rotSpeed1 = 0.001;
        rotSpeed2 = -0.0008;
        rotSpeed3 = 0.0005;
        pulseScale = 1.02;
      } else if (currentState === 'speaking') {
        // Beat: energetic rhythmic pulse
        beatTime += 0.14;
        pulseScale = 1.0 + Math.sin(beatTime) * 0.12 + Math.sin(beatTime * 2.3) * 0.06;
        rotSpeed1 = 0.012;
        rotSpeed2 = -0.016;
        rotSpeed3 = 0.009;
      } else {
        // Idle: continuous smooth ambient rotation
        rotSpeed1 = 0.006;
        rotSpeed2 = -0.008;
        rotSpeed3 = 0.004;
        pulseScale = 1.0 + Math.sin(Date.now() * 0.002) * 0.02;
      }

      angle1 += rotSpeed1;
      angle2 += rotSpeed2;
      angle3 += rotSpeed3;

      const baseR = R * pulseScale;

      // Glow Settings
      ctx.shadowBlur = currentState === 'speaking' ? 24 : 14;
      ctx.shadowColor = '#ff9e1f';

      // 1. Outer Dashed Ring & Tech Ticks
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(angle1);
      ctx.beginPath();
      ctx.arc(0, 0, baseR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 158, 31, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([12, 18, 4, 18]);
      ctx.stroke();

      // Outer radial ticks
      for (let i = 0; i < 36; i++) {
        const rad = (i / 36) * Math.PI * 2;
        const tickLen = i % 4 === 0 ? 12 : 5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rad) * (baseR - tickLen), Math.sin(rad) * (baseR - tickLen));
        ctx.lineTo(Math.cos(rad) * baseR, Math.sin(rad) * baseR);
        ctx.strokeStyle = i % 4 === 0 ? 'rgba(255, 190, 74, 0.8)' : 'rgba(255, 158, 31, 0.3)';
        ctx.lineWidth = i % 4 === 0 ? 2 : 1;
        ctx.stroke();
      }
      ctx.restore();

      // 2. Middle Ring: Segmented High-Tech Energy Arcs
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(angle2);
      const midR = baseR * 0.78;
      ctx.setLineDash([]);
      for (let s = 0; s < 4; s++) {
        const start = s * (Math.PI / 2) + 0.15;
        const end = start + (Math.PI / 2) - 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, midR, start, end);
        ctx.strokeStyle = 'rgba(255, 180, 50, 0.75)';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // End notches
        ctx.fillStyle = '#ffbe4a';
        ctx.beginPath();
        ctx.arc(Math.cos(start) * midR, Math.sin(start) * midR, 3, 0, Math.PI * 2);
        ctx.arc(Math.cos(end) * midR, Math.sin(end) * midR, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3. Inner Swirling Vortex Ring
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(angle3);
      const inR = baseR * 0.54;
      ctx.beginPath();
      ctx.arc(0, 0, inR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 14]);
      ctx.stroke();
      ctx.restore();

      // 4. Floating Ambient Energy Particles (Circuit Embers)
      ctx.save();
      ctx.translate(CX, CY);
      ctx.setLineDash([]);
      for (let p of particles) {
        if (currentState !== 'listening') {
          p.angle += p.speed;
        }
        const curR = baseR * p.radiusRatio;
        const px = Math.cos(p.angle) * curR;
        const py = Math.sin(p.angle) * curR;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 190, 70, ${p.alpha})`;
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.restore();

      // 5. Beating Shockwave Rings in Speaking State
      if (currentState === 'speaking') {
        ctx.save();
        ctx.translate(CX, CY);
        const waveR = baseR * (0.8 + (beatTime % 1.5) * 0.25);
        ctx.beginPath();
        ctx.arc(0, 0, waveR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 190, 74, ${Math.max(0, 0.7 - (beatTime % 1.5) * 0.4)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      requestAnimationFrame(drawArcReactor);
    }
    requestAnimationFrame(drawArcReactor);

    /* -------------------------------------------------------------
       State Transition & UI Handlers
       ------------------------------------------------------------- */
    const coreBtn = document.getElementById('core-btn');
    const coreStatus = document.getElementById('core-status');
    const responseCapsule = document.getElementById('response-capsule');
    const cmdInput = document.getElementById('cmd-input');

    function setState(newState, text = '') {
      currentState = newState;
      if (newState === 'listening') {
        coreStatus.textContent = 'LISTENING';
        coreStatus.style.color = '#38bdf8';
        responseCapsule.className = 'capsule';
        if (text) responseCapsule.textContent = text;
      } else if (newState === 'speaking') {
        coreStatus.textContent = 'TALKING';
        coreStatus.style.color = '#fbbf24';
        responseCapsule.className = 'capsule speaking';
        if (text) responseCapsule.textContent = text;
      } else {
        coreStatus.textContent = 'ACTIVE';
        coreStatus.style.color = 'var(--gold-bright)';
        responseCapsule.className = 'capsule';
        if (text) responseCapsule.textContent = text;
      }
    }

    // Speech Synthesis for Cris (Beat synchronizer)
    function speakText(text) {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Auto-select Bengali vs English voice
      const hasBengali = /[\u0980-\u09FF]/.test(text);
      utterance.lang = hasBengali ? 'bn-BD' : 'en-US';

      utterance.onstart = () => {
        setState('speaking', text);
      };
      utterance.onend = () => {
        setState('idle');
      };
      utterance.onerror = () => {
        setState('idle');
      };
      window.speechSynthesis.speak(utterance);
    }

    // Browser Web Speech Recognition
    let recognition = null;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setState('listening', 'Listening to your voice...');
      };
      recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setState('idle');
        sendPrompt(transcript);
      };
      recognition.onerror = () => {
        setState('idle', 'Speech recognition paused.');
      };
      recognition.onend = () => {
        if (currentState === 'listening') setState('idle');
      };
    }

    function toggleVoiceInput() {
      if (!recognition) {
        alert('Voice recognition not supported in this browser. Use Chrome, Edge, or type in the input box.');
        return;
      }
      if (currentState === 'listening') {
        recognition.stop();
        setState('idle');
      } else {
        try {
          recognition.start();
        } catch(e) {
          recognition.stop();
        }
      }
    }

    // Backend Communication
    async function sendPrompt(text) {
      if (!text.trim()) return;
      responseCapsule.textContent = `Processing: "${text}"...`;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        const reply = data.reply || data.error || 'Done.';
        responseCapsule.textContent = reply;
        speakText(reply);
      } catch (err) {
        responseCapsule.textContent = 'Error communicating with Cris: ' + err;
        setState('idle');
      }
    }

    function handleSend(e) {
      e.preventDefault();
      const val = cmdInput.value.trim();
      if (val) {
        sendPrompt(val);
        cmdInput.value = '';
      }
    }

    async function triggerKillSwitch() {
      await fetch('/api/kill_switch', { method: 'POST' });
      setState('idle', '[KILL SWITCH] Emergency halt engaged.');
    }

    // Live Telemetry Sync
    async function syncTelemetry() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.model) document.getElementById('model-id').textContent = data.model.toUpperCase().replace('GEMINI-', '');
        if (data.metrics && data.metrics.cpu_percent) document.getElementById('cpu-stat').textContent = data.metrics.cpu_percent + '%';
        if (data.metrics && data.metrics.ram) document.getElementById('ram-stat').textContent = data.metrics.ram.percent_used + '%';
      } catch(e) {}
    }
    setInterval(syncTelemetry, 4000);
    syncTelemetry();

    // Hotkey listener for Ctrl+Alt+Q
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'q') {
        triggerKillSwitch();
      }
    });
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
        if self.path in ("/", "/index.html"):
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
    print(f" Cris Holographic Arc Reactor Core: http://localhost:{port}")
    print(f"=======================================================\n")
    server.serve_forever()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)
