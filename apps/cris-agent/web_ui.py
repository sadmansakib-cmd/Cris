"""
Cris Agent - Holographic Arc Reactor Web Dashboard & Voice Interface (v1.4 Integrated Workspace)
- Local Server Hardening: Bound strictly to 127.0.0.1, per-launch random token authentication,
  Host/Origin anti-DNS rebinding and anti-CSRF protection, no wildcard CORS.
- Minimal HUD: Single status indicator, subtitle capsule, telemetry behind toggle flyout.
- Integrated Web Workspace Sidebar: Hideable, resizable browser container embedding web apps
  (e.g. Quest Clock Rank Up on port 5174, Google, web tools, live Quest HUD).
- Voice & Keyboard controllable ("Cris, open sidebar", "Cris, assign a new task: Running, level 3",
  "Cris, task done", "Cris, download a picture of...", "Cris, delete file...").
- Full Quest Gamification: Levels 1-5, XP rewards, rank up progression (E-Rank to S-Rank Monarch).
"""

from __future__ import annotations

import json
import logging
import os
import re
import secrets
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from config import AppConfig
from core.config_loader import load_config
from core.confirmation_gate import ConfirmationGate
from core.kill_switch import KillSwitch
from core.llm_provider import ResilientLLMClient
from core.personality import detect_language, get_system_prompt
from core.scheduler import BackgroundScheduler
from core.task_runner import TaskRunner
from memory.sqlite_store import SQLiteStore
from tools import image_downloader, quest_tool, system_status
from tools.registry import ToolRegistry

logger = logging.getLogger("cris.web_ui")

# Hardened Server Constants
BIND_HOST = "127.0.0.1"
LAUNCH_TOKEN = os.getenv("CRIS_SERVER_TOKEN") or secrets.token_urlsafe(32)


def check_origin_and_host(headers: dict, port: int = 8000) -> bool:
    """Validate Host and Origin headers to block CSRF and DNS rebinding."""
    host = headers.get("Host", "").strip()
    if not host:
        return False
    host_name = host.split(":")[0].lower()
    allowed_hosts = {"127.0.0.1", "localhost"}
    if host_name not in allowed_hosts:
        return False

    origin = headers.get("Origin", "").strip()
    if origin:
        try:
            parsed = urlparse(origin)
            origin_host = (parsed.hostname or "").lower()
            if origin_host not in allowed_hosts:
                return False
        except Exception:
            return False

    return True


def validate_token(headers: dict, path: str, server_token: str) -> bool:
    """Verify ephemeral token from header or query parameter."""
    token = headers.get("X-Cris-Token")
    if token and token == server_token:
        return True

    auth = headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        bearer_token = auth[7:].strip()
        if bearer_token == server_token:
            return True

    try:
        parsed = urlparse(path)
        qs = parse_qs(parsed.query)
        if "token" in qs and qs["token"][0] == server_token:
            return True
    except Exception:
        pass

    return False


HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRIS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #030407;
      --gold: #ff9e1f;
      --gold-bright: #ffbe4a;
      --gold-glow: rgba(255, 158, 31, 0.45);
      --gold-soft: rgba(255, 158, 31, 0.12);
      --red: #ef4444;
      --green: #10b981;
      --blue: #3b82f6;
      --purple: #8b5cf6;
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

    .bg-vignette {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(255, 136, 0, 0.07) 0%, rgba(3, 4, 7, 0.95) 75%, #030407 100%);
      pointer-events: none;
      z-index: 1;
    }

    .hud-frame {
      position: absolute;
      inset: 16px;
      pointer-events: none;
      z-index: 10;
      border: 1px solid rgba(255, 158, 31, 0.14);
    }
    .hud-corner {
      position: absolute;
      width: 24px;
      height: 24px;
      border-color: var(--gold);
      border-style: solid;
    }
    .top-left { top: -2px; left: -2px; border-width: 2px 0 0 2px; }
    .top-right { top: -2px; right: -2px; border-width: 2px 2px 0 0; }
    .bottom-left { bottom: -2px; left: -2px; border-width: 0 0 2px 2px; }
    .bottom-right { bottom: -2px; right: -2px; border-width: 0 2px 2px 0; }

    /* Top HUD telemetry bar matching the reference image */
    .hud-top-telemetry {
      position: absolute;
      top: 6px;
      left: 120px;
      right: 120px;
      height: 12px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      pointer-events: none;
    }
    .hud-top-line {
      width: 140px;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(255, 158, 31, 0.5));
    }
    .hud-top-box {
      width: 28px;
      height: 7px;
      background: rgba(255, 158, 31, 0.4);
      border: 1px solid var(--gold);
    }
    .hud-top-dots {
      display: flex;
      gap: 3px;
    }
    .hud-top-dots span {
      width: 4px;
      height: 4px;
      background: var(--gold-bright);
      display: inline-block;
    }
    .hud-left-bracket {
      position: absolute;
      top: 110px;
      left: 0;
      width: 130px;
      height: 1px;
      background: rgba(255, 158, 31, 0.35);
      pointer-events: none;
    }
    .hud-left-bracket::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 1px;
      height: 90px;
      background: rgba(255, 158, 31, 0.35);
    }
    .hud-bottom-compass {
      position: absolute;
      bottom: 8px;
      right: 8px;
      width: 58px;
      height: 58px;
      pointer-events: none;
      opacity: 0.85;
    }

    header {
      width: 100%;
      padding: 1.25rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 20;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.8rem;
      color: var(--gold-bright);
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--gold);
      box-shadow: 0 0 8px var(--gold);
      transition: all 0.3s;
    }
    .status-dot.listening { background: var(--green); box-shadow: 0 0 10px var(--green); }
    .status-dot.talking { background: var(--blue); box-shadow: 0 0 12px var(--blue); }
    .status-dot.working { background: var(--red); box-shadow: 0 0 10px var(--red); }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .icon-btn {
      background: rgba(255, 158, 31, 0.08);
      border: 1px solid rgba(255, 158, 31, 0.25);
      color: var(--gold-bright);
      border-radius: 8px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.2s;
      position: relative;
    }
    .icon-btn:hover {
      background: rgba(255, 158, 31, 0.2);
      border-color: var(--gold);
      box-shadow: 0 0 10px var(--gold-glow);
    }
    .icon-btn.active {
      background: var(--gold);
      color: #000;
      box-shadow: 0 0 14px var(--gold);
    }
    .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: var(--red);
      color: #fff;
      font-size: 0.65rem;
      padding: 2px 5px;
      border-radius: 10px;
      font-weight: 700;
    }

    .telemetry-flyout {
      position: absolute;
      top: 4.5rem;
      right: 2rem;
      background: rgba(8, 12, 20, 0.95);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 158, 31, 0.3);
      border-radius: 12px;
      padding: 1rem 1.5rem;
      display: none;
      flex-direction: column;
      gap: 0.75rem;
      font-size: 0.75rem;
      z-index: 50;
      box-shadow: 0 8px 32px rgba(0,0,0,0.8);
    }
    .telemetry-flyout.active { display: flex; }
    .stat-row { display: flex; justify-content: space-between; gap: 2rem; }
    .stat-val { color: var(--gold-bright); font-weight: 600; }

    .core-container {
      position: relative;
      width: min(72vh, 580px);
      height: min(72vh, 580px);
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
    .core-center-btn {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 230, 160, 0.12) 0%, rgba(255, 140, 20, 0.04) 60%, transparent 100%);
      border: 1px dashed rgba(255, 185, 45, 0.45);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(2px);
    }
    .core-center-btn:hover {
      transform: scale(1.08);
      border-color: var(--gold-bright);
      box-shadow: 0 0 35px var(--gold-glow);
    }
    .center-glyph {
      font-size: 1.8rem;
      color: var(--gold-bright);
      text-shadow: 0 0 16px var(--gold);
      transition: transform 0.3s;
    }
    .core-center-btn:hover .center-glyph {
      transform: rotate(45deg);
    }

    .subtitle-capsule {
      position: absolute;
      bottom: 6.5rem;
      max-width: min(85vw, 680px);
      background: rgba(10, 15, 24, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 158, 31, 0.3);
      border-radius: 30px;
      padding: 0.75rem 1.75rem;
      font-family: var(--font-sans);
      font-size: 0.95rem;
      color: #e2e8f0;
      text-align: center;
      line-height: 1.5;
      box-shadow: 0 8px 30px rgba(0,0,0,0.6);
      z-index: 25;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s ease;
    }
    .subtitle-capsule.visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* Left Icon Dock */
    .icon-dock {
      position: absolute;
      left: 1.5rem;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(10, 15, 24, 0.75);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 158, 31, 0.2);
      border-radius: 30px;
      padding: 0.75rem 0.4rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      z-index: 30;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    }
    .dock-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: transparent;
      border: 1px solid transparent;
      color: rgba(255, 255, 255, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }
    .dock-btn:hover, .dock-btn.active {
      background: rgba(255, 158, 31, 0.18);
      border-color: rgba(255, 158, 31, 0.4);
      color: var(--gold-bright);
      transform: scale(1.1);
      box-shadow: 0 0 12px var(--gold-glow);
    }
    .dock-btn[title]:hover::after {
      content: attr(title);
      position: absolute;
      left: 52px;
      background: rgba(10, 15, 24, 0.95);
      border: 1px solid rgba(255, 158, 31, 0.3);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      color: #fff;
      white-space: nowrap;
      pointer-events: none;
      z-index: 100;
    }

    /* Bottom Input Bar */
    footer {
      width: 100%;
      padding: 1.25rem 2rem 2rem 2rem;
      display: flex;
      justify-content: center;
      z-index: 20;
    }
    .input-bar {
      width: min(700px, 90vw);
      background: rgba(10, 15, 25, 0.8);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 158, 31, 0.25);
      border-radius: 30px;
      display: flex;
      align-items: center;
      padding: 0.4rem 0.6rem 0.4rem 1.4rem;
      transition: border-color 0.3s;
    }
    .input-bar:focus-within {
      border-color: var(--gold);
      box-shadow: 0 0 20px var(--gold-glow);
    }
    input#chat-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #fff;
      font-family: var(--font-mono);
      font-size: 0.9rem;
    }
    input#chat-input::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }
    .send-btn {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--gold);
      border: none;
      color: #030407;
      font-weight: 700;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s, background 0.2s;
    }
    .send-btn:hover {
      transform: scale(1.08);
      background: var(--gold-bright);
    }

    /* Left Slide-Over Glass Module Panels */
    .module-panel {
      position: absolute;
      top: 2rem;
      bottom: 2rem;
      left: 5.5rem;
      width: min(580px, calc(100vw - 7rem));
      background: rgba(10, 15, 25, 0.94);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 158, 31, 0.3);
      border-radius: 16px;
      z-index: 40;
      display: flex;
      flex-direction: column;
      transform: translateX(-120%);
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8);
      overflow: hidden;
    }
    .module-panel.open {
      transform: translateX(0);
    }
    .panel-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid rgba(255, 158, 31, 0.15);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .panel-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--gold-bright);
      letter-spacing: 0.05em;
    }
    .panel-close {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      font-size: 1.2rem;
      cursor: pointer;
      line-height: 1;
    }
    .panel-close:hover { color: #fff; }
    .panel-body {
      flex: 1;
      padding: 1.25rem 1.5rem;
      overflow-y: auto;
      font-family: var(--font-sans);
      font-size: 0.85rem;
      color: #cbd5e1;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .panel-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 158, 31, 0.12);
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .panel-btn {
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid var(--gold);
      background: rgba(255, 158, 31, 0.15);
      color: var(--gold-bright);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      cursor: pointer;
      align-self: flex-start;
      transition: all 0.2s;
    }
    .panel-btn:hover {
      background: var(--gold);
      color: #000;
    }
    .panel-btn.danger {
      border-color: var(--red);
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
    }
    .panel-btn.danger:hover {
      background: var(--red);
      color: #fff;
    }

    /* RIGHT SLIDE-OUT INTEGRATED WEB WORKSPACE SIDEBAR */
    .sidebar-panel {
      position: absolute;
      top: 1rem;
      bottom: 1rem;
      right: 1rem;
      width: min(720px, calc(100vw - 3rem));
      background: rgba(8, 12, 20, 0.96);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 158, 31, 0.35);
      border-radius: 16px;
      z-index: 45;
      display: flex;
      flex-direction: column;
      transform: translateX(120%);
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.9);
      overflow: hidden;
    }
    .sidebar-panel.open {
      transform: translateX(0);
    }
    .sidebar-header {
      padding: 0.8rem 1.2rem;
      background: rgba(15, 23, 42, 0.6);
      border-bottom: 1px solid rgba(255, 158, 31, 0.2);
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .sidebar-tabs {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .side-tab {
      padding: 5px 12px;
      border-radius: 6px;
      border: 1px solid rgba(255, 158, 31, 0.2);
      background: rgba(255, 158, 31, 0.08);
      color: #cbd5e1;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .side-tab:hover, .side-tab.active {
      background: rgba(255, 158, 31, 0.25);
      border-color: var(--gold);
      color: var(--gold-bright);
    }
    .sidebar-address-bar {
      display: flex;
      gap: 0.4rem;
      align-items: center;
    }
    .sidebar-url-input {
      flex: 1;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 158, 31, 0.2);
      border-radius: 6px;
      padding: 6px 10px;
      color: #fff;
      font-family: var(--font-mono);
      font-size: 0.8rem;
    }
    .sidebar-url-input:focus {
      outline: none;
      border-color: var(--gold);
    }
    .sidebar-action-btn {
      width: 30px;
      height: 30px;
      border-radius: 6px;
      border: 1px solid rgba(255, 158, 31, 0.2);
      background: rgba(255, 158, 31, 0.1);
      color: var(--gold-bright);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .sidebar-action-btn:hover {
      background: var(--gold);
      color: #000;
    }
    .sidebar-action-btn.close-btn {
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.3);
    }
    .sidebar-action-btn.close-btn:hover {
      background: #ef4444;
      color: #fff;
    }
    .sidebar-content {
      flex: 1;
      position: relative;
      background: #020617;
      overflow: hidden;
    }
    iframe#sidebar-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #0b0f19;
    }

    /* Live Quests HUD Widget inside Sidebar */
    .quest-hud-view {
      position: absolute;
      inset: 0;
      padding: 1.25rem;
      overflow-y: auto;
      display: none;
      flex-direction: column;
      gap: 1rem;
      background: #030712;
      font-family: var(--font-sans);
    }
    .quest-hud-view.active {
      display: flex;
    }
    .quest-rank-card {
      background: linear-gradient(135deg, rgba(255,158,31,0.15) 0%, rgba(139,92,246,0.15) 100%);
      border: 1px solid rgba(255, 158, 31, 0.4);
      border-radius: 12px;
      padding: 1.2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rank-badge {
      background: var(--gold);
      color: #000;
      padding: 4px 10px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
    }
    .quest-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 158, 31, 0.15);
      border-radius: 10px;
      padding: 0.9rem 1.1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s;
    }
    .quest-item.done {
      opacity: 0.55;
      text-decoration: line-through;
      border-color: rgba(16, 185, 129, 0.3);
    }
    .quest-checkbox {
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: 2px solid var(--gold);
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #000;
      font-weight: bold;
      transition: all 0.2s;
    }
    .quest-checkbox.checked {
      background: var(--green);
      border-color: var(--green);
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="bg-vignette"></div>

  <div class="hud-frame">
    <div class="hud-corner top-left"></div>
    <div class="hud-corner top-right"></div>
    <div class="hud-corner bottom-left"></div>
    <div class="hud-corner bottom-right"></div>
    <div class="hud-top-telemetry">
      <div class="hud-top-line"></div>
      <div class="hud-top-box"></div>
      <div class="hud-top-dots"><span></span><span></span></div>
    </div>
    <div class="hud-left-bracket"></div>
    <div class="hud-bottom-compass">
      <canvas id="compass-canvas" width="58" height="58"></canvas>
    </div>
  </div>

  <header>
    <div class="status-badge">
      <div class="status-dot" id="status-dot"></div>
      <span id="status-label">idle</span>
    </div>

    <div class="top-actions">
      <button class="icon-btn" id="sidebar-toggle-btn" title="Toggle Integrated Workspace (Ctrl+B)">🌐</button>
      <button class="icon-btn" id="telemetry-btn" title="System Telemetry">⚡</button>
      <button class="icon-btn" id="kill-btn" title="Emergency Stop (Ctrl+Alt+Q)" style="border-color: rgba(239,68,68,0.4); color: #ef4444;">🛑</button>
    </div>
  </header>

  <!-- Telemetry Dropdown -->
  <div class="telemetry-flyout" id="telemetry-flyout">
    <div class="stat-row"><span>CPU Usage</span><span class="stat-val" id="stat-cpu">--%</span></div>
    <div class="stat-row"><span>Memory</span><span class="stat-val" id="stat-ram">--%</span></div>
    <div class="stat-row"><span>Battery</span><span class="stat-val" id="stat-battery">--%</span></div>
    <div class="stat-row"><span>Model</span><span class="stat-val" id="stat-model">--</span></div>
  </div>

  <!-- Left Icon Dock -->
  <div class="icon-dock">
    <button class="dock-btn" data-panel="tasks" title="Tasks">📋</button>
    <button class="dock-btn" data-panel="approvals" title="Approvals">
      🛡️
      <span class="badge" id="approvals-badge" style="display:none;">0</span>
    </button>
    <button class="dock-btn" data-panel="web_agent" title="Web Agent">🌐</button>
    <button class="dock-btn" data-panel="notes" title="Notes & Timers">📝</button>
    <button class="dock-btn" data-panel="files" title="Files">📁</button>
    <button class="dock-btn" data-panel="google" title="Google">📅</button>
    <button class="dock-btn" data-panel="github" title="GitHub">🐙</button>
    <button class="dock-btn" data-panel="memory" title="Memory">🧠</button>
    <button class="dock-btn" data-panel="skills" title="Skills">⚡</button>
    <button class="dock-btn" data-panel="logs" title="Logs">📜</button>
    <button class="dock-btn" data-panel="settings" title="Settings">⚙️</button>
  </div>

  <!-- Left Slide-Over Glass Module Panels -->
  <div class="module-panel" id="module-panel">
    <div class="panel-header">
      <div class="panel-title" id="panel-title">Panel</div>
      <button class="panel-close" id="panel-close">✕</button>
    </div>
    <div class="panel-body" id="panel-body"></div>
  </div>

  <!-- RIGHT SLIDE-OUT INTEGRATED WEB WORKSPACE SIDEBAR -->
  <div class="sidebar-panel" id="sidebar-panel">
    <div class="sidebar-header">
      <div class="sidebar-tabs">
        <button class="side-tab active" id="tab-quest" data-url="http://localhost:5174/">⚔️ Questlog App</button>
        <button class="side-tab" id="tab-hud">📜 Quests HUD</button>
        <button class="side-tab" id="tab-google" data-url="https://duckduckgo.com">🔍 Web Search</button>
      </div>
      <div class="sidebar-address-bar">
        <input type="text" class="sidebar-url-input" id="sidebar-url-input" value="http://localhost:5174/">
        <button class="sidebar-action-btn" id="sidebar-go-btn" title="Navigate">➔</button>
        <button class="sidebar-action-btn" id="sidebar-reload-btn" title="Reload">↻</button>
        <button class="sidebar-action-btn" id="sidebar-popout-btn" title="Open in New Tab">↗</button>
        <button class="sidebar-action-btn close-btn" id="sidebar-close-btn" title="Close Sidebar">✕</button>
      </div>
    </div>
    <div class="sidebar-content">
      <iframe id="sidebar-iframe" src="http://localhost:5174/"></iframe>
      <div class="quest-hud-view" id="quest-hud-view">
        <div class="quest-rank-card">
          <div>
            <h3 style="color:#fff;font-size:1.1rem;font-weight:700;">Quest Clock Rank Up</h3>
            <p style="color:#94a3b8;font-size:0.8rem;margin-top:2px;">Gamified task tracker synced with Cris</p>
          </div>
          <div style="text-align:right;">
            <div class="rank-badge" id="player-rank-badge">E-Rank Novice</div>
            <p style="font-size:0.8rem;color:var(--gold-bright);margin-top:4px;" id="player-xp-label">0 XP</p>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4 style="color:#cbd5e1;font-size:0.9rem;">Active Quests</h4>
          <button class="panel-btn" id="new-quest-modal-btn">+ Assign Quest</button>
        </div>

        <div id="quest-items-list" style="display:flex;flex-direction:column;gap:0.6rem;"></div>
      </div>
    </div>
  </div>

  <!-- Center Stage: Arc Reactor Canvas -->
  <div class="core-container">
    <canvas id="arc-canvas"></canvas>
    <div class="core-center-btn" id="core-btn">
      <div class="center-glyph">✦</div>
    </div>
  </div>

  <!-- Floating Subtitle Capsule -->
  <div class="subtitle-capsule" id="subtitle">Cris is ready.</div>

  <!-- Input Bar -->
  <footer>
    <div class="input-bar">
      <input type="text" id="chat-input" placeholder="Ask Cris (or 'Cris, assign a new task...', 'download picture...')" autocomplete="off">
      <button class="send-btn" id="send-btn">➔</button>
    </div>
  </footer>

  <script>
    const CRIS_TOKEN = "__CRIS_TOKEN_PLACEHOLDER__";

    let currentState = "idle";
    let rotationAngle = 0;
    let currentSpeed = 0.005;
    let targetSpeed = 0.005;
    let pulseScale = 1.0;

    // Cosmic Ember Particle Field (160 particles swirling in 3D orbit)
    const PARTICLE_COUNT = 160;
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        rFactor: 0.08 + Math.pow(Math.random(), 1.5) * 0.38,
        angle: Math.random() * Math.PI * 2,
        speed: (0.003 + Math.random() * 0.007),
        size: 0.7 + Math.random() * 1.8,
        alpha: 0.2 + Math.random() * 0.7,
        eccentricity: 0.92 + (Math.random() - 0.5) * 0.12
      });
    }

    const canvas = document.getElementById("arc-canvas");
    const ctx = canvas.getContext("2d");
    const compassCanvas = document.getElementById("compass-canvas");
    const compassCtx = compassCanvas ? compassCanvas.getContext("2d") : null;
    let compassAngle = 0;

    function drawCompass() {
      if (!compassCtx) return;
      const cw = compassCanvas.width;
      const ch = compassCanvas.height;
      const cx = cw / 2;
      const cy = ch / 2;
      compassCtx.clearRect(0, 0, cw, ch);
      compassAngle += 0.008;

      compassCtx.save();
      compassCtx.translate(cx, cy);

      // Outer dial ring
      compassCtx.strokeStyle = "rgba(255, 158, 31, 0.45)";
      compassCtx.lineWidth = 1;
      compassCtx.beginPath();
      compassCtx.arc(0, 0, cx * 0.88, 0, Math.PI * 2);
      compassCtx.stroke();

      // Rotating tick marks
      compassCtx.rotate(compassAngle);
      for (let i = 0; i < 12; i++) {
        const rad = (i * Math.PI * 2) / 12;
        const r1 = cx * (i % 3 === 0 ? 0.65 : 0.76);
        const r2 = cx * 0.85;
        compassCtx.strokeStyle = (i % 3 === 0) ? "#ffbe4a" : "rgba(255, 158, 31, 0.35)";
        compassCtx.lineWidth = (i % 3 === 0) ? 1.5 : 1;
        compassCtx.beginPath();
        compassCtx.moveTo(Math.cos(rad) * r1, Math.sin(rad) * r1);
        compassCtx.lineTo(Math.cos(rad) * r2, Math.sin(rad) * r2);
        compassCtx.stroke();
      }

      // Center crosshair
      compassCtx.strokeStyle = "rgba(255, 190, 74, 0.65)";
      compassCtx.beginPath();
      compassCtx.moveTo(-cx * 0.28, 0);
      compassCtx.lineTo(cx * 0.28, 0);
      compassCtx.moveTo(0, -cy * 0.28);
      compassCtx.lineTo(0, cy * 0.28);
      compassCtx.stroke();

      compassCtx.restore();
    }

    const statusDot = document.getElementById("status-dot");
    const statusLabel = document.getElementById("status-label");
    const subtitle = document.getElementById("subtitle");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");
    const coreBtn = document.getElementById("core-btn");
    const telemetryBtn = document.getElementById("telemetry-btn");
    const telemetryFlyout = document.getElementById("telemetry-flyout");
    const killBtn = document.getElementById("kill-btn");
    const modulePanel = document.getElementById("module-panel");
    const panelTitle = document.getElementById("panel-title");
    const panelBody = document.getElementById("panel-body");
    const panelClose = document.getElementById("panel-close");
    const approvalsBadge = document.getElementById("approvals-badge");

    // Sidebar DOM
    const sidebarPanel = document.getElementById("sidebar-panel");
    const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
    const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
    const sidebarUrlInput = document.getElementById("sidebar-url-input");
    const sidebarGoBtn = document.getElementById("sidebar-go-btn");
    const sidebarReloadBtn = document.getElementById("sidebar-reload-btn");
    const sidebarPopoutBtn = document.getElementById("sidebar-popout-btn");
    const sidebarIframe = document.getElementById("sidebar-iframe");
    const tabQuest = document.getElementById("tab-quest");
    const tabHud = document.getElementById("tab-hud");
    const tabGoogle = document.getElementById("tab-google");
    const questHudView = document.getElementById("quest-hud-view");
    const questItemsList = document.getElementById("quest-items-list");
    const playerRankBadge = document.getElementById("player-rank-badge");
    const playerXpLabel = document.getElementById("player-xp-label");
    const newQuestModalBtn = document.getElementById("new-quest-modal-btn");

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    function setState(newState) {
      currentState = newState;
      statusDot.className = "status-dot " + (newState === "idle" ? "" : newState);
      statusLabel.textContent = newState;
      if (newState === "listening") {
        targetSpeed = 0.0003; // Smoothly stabilizes into steady lock when voice is heard
      } else if (newState === "talking") {
        targetSpeed = 0.012;  // Rhythmic beat pulse with energy shockwaves
      } else if (newState === "working") {
        targetSpeed = 0.022;  // High energy scanning
      } else {
        targetSpeed = 0.005;  // Default smooth rotation
      }
    }

    function showSubtitle(text) {
      subtitle.textContent = text;
      subtitle.classList.add("visible");
    }

    function drawArcReactor() {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      const cx = w / 2;
      const cy = h / 2;
      ctx.clearRect(0, 0, w, h);

      // Smooth deceleration / acceleration
      currentSpeed += (targetSpeed - currentSpeed) * 0.05;
      rotationAngle += currentSpeed;

      // Audio beat scale pulse when talking
      if (currentState === "talking") {
        const beat1 = Math.sin(Date.now() * 0.016);
        const beat2 = Math.sin(Date.now() * 0.032 + 0.4);
        pulseScale = 1.0 + Math.max(0, beat1) * 0.09 + Math.max(0, beat2) * 0.05;
      } else {
        pulseScale = 1.0;
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulseScale, pulseScale);

      // 1. Core Background Ambient Glow
      const bgGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.46);
      bgGrad.addColorStop(0, "rgba(255, 170, 30, 0.22)");
      bgGrad.addColorStop(0.3, "rgba(255, 110, 0, 0.08)");
      bgGrad.addColorStop(0.65, "rgba(255, 60, 0, 0.02)");
      bgGrad.addColorStop(1, "rgba(3, 4, 7, 0)");
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.46, 0, Math.PI * 2);
      ctx.fill();

      // 2. Audio Shockwave Ripples (Expanding outward when talking)
      if (currentState === "talking") {
        for (let wave = 0; wave < 3; wave++) {
          const wavePhase = ((Date.now() * 0.12 + wave * 90) % (w * 0.42));
          const waveAlpha = Math.max(0, 0.5 * (1 - wavePhase / (w * 0.42)));
          ctx.strokeStyle = `rgba(255, 195, 65, ${waveAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, wavePhase, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 3. Galactic Fiery Plasma Whirlpool Filaments (6 logarithmic spiral arms matching reference image)
      for (let arm = 0; arm < 6; arm++) {
        const armAngle = (arm * Math.PI * 2) / 6;
        ctx.beginPath();
        for (let t = 0; t <= 1.0; t += 0.03) {
          const r = (w * 0.22) * Math.pow(t, 1.25);
          const theta = armAngle + (rotationAngle * 2.2) + (t * 3.6);
          const x = Math.cos(theta) * r;
          const y = Math.sin(theta) * r;
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const armAlpha = 0.35 + 0.3 * Math.sin(Date.now() * 0.004 + arm);
        ctx.strokeStyle = `rgba(255, 175, 40, ${armAlpha})`;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      // 4. White-Hot Central Singularity Nucleus
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.12);
      coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      coreGrad.addColorStop(0.2, "rgba(255, 225, 120, 0.85)");
      coreGrad.addColorStop(0.5, "rgba(255, 140, 20, 0.45)");
      coreGrad.addColorStop(0.8, "rgba(255, 80, 0, 0.15)");
      coreGrad.addColorStop(1, "rgba(3, 4, 7, 0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.12, 0, Math.PI * 2);
      ctx.fill();

      // 5. Multi-Layer Concentric Orbiting Rings
      // Layer 1: Inner Fast Filament Arc
      ctx.save();
      ctx.rotate(rotationAngle * 1.6);
      ctx.strokeStyle = "rgba(255, 205, 75, 0.7)";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([28, 10, 8, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Layer 2: Counter-Rotating Technical Track
      ctx.save();
      ctx.rotate(-rotationAngle * 2.0);
      ctx.strokeStyle = "rgba(255, 160, 30, 0.65)";
      ctx.lineWidth = 2.0;
      ctx.setLineDash([42, 14, 12, 14]);
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Layer 3: Planetary Ring Disc (Concentric Micro-Grooves & Radar Ticks)
      ctx.save();
      ctx.rotate(rotationAngle * 0.7);
      // Fine concentric orbital grooves
      for (let g = 0; g < 7; g++) {
        const gr = w * (0.28 + g * 0.015);
        ctx.strokeStyle = `rgba(255, 175, 35, ${0.15 + (g % 2) * 0.12})`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash(g % 2 === 0 ? [80, 16] : [40, 12, 10, 12]);
        ctx.beginPath();
        ctx.arc(0, 0, gr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 48 Radial Calibration Ticks
      const ticks = 48;
      for (let i = 0; i < ticks; i++) {
        const rad = (i * Math.PI * 2) / ticks;
        const isMajor = (i % 4 === 0);
        const r1 = w * (isMajor ? 0.30 : 0.32);
        const r2 = w * 0.35;
        ctx.strokeStyle = isMajor ? "rgba(255, 200, 75, 0.75)" : "rgba(255, 150, 25, 0.3)";
        ctx.lineWidth = isMajor ? 1.6 : 0.9;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(Math.cos(rad) * r1, Math.sin(rad) * r1);
        ctx.lineTo(Math.cos(rad) * r2, Math.sin(rad) * r2);
        ctx.stroke();
      }
      ctx.restore();

      // Layer 4: Outer Containment Caliper Brackets
      ctx.save();
      ctx.rotate(-rotationAngle * 0.9);
      ctx.strokeStyle = "rgba(255, 185, 45, 0.55)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([55, 18, 12, 18]);
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.41, 0, Math.PI * 2);
      ctx.stroke();

      // Equidistant Reticle Nodes
      for (let n = 0; n < 6; n++) {
        const nrad = (n * Math.PI * 2) / 6;
        const nx = Math.cos(nrad) * (w * 0.41);
        const ny = Math.sin(nrad) * (w * 0.41);
        ctx.fillStyle = "#ffbe4a";
        ctx.beginPath();
        ctx.arc(nx, ny, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Layer 5: Outermost Horizon Radar Boundary
      ctx.strokeStyle = "rgba(255, 140, 20, 0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 11]);
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.45, 0, Math.PI * 2);
      ctx.stroke();

      // 6. Cosmic Stardust Ember Particles Field
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.angle += p.speed * (currentSpeed / 0.005);
        const pr = p.rFactor * w;
        const px = Math.cos(p.angle) * pr;
        const py = Math.sin(p.angle) * pr * p.eccentricity;
        ctx.fillStyle = `rgba(255, 195, 75, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Draw corner compass reticle
      drawCompass();

      requestAnimationFrame(drawArcReactor);
    }
    drawArcReactor();

    async function apiFetch(url, options = {}) {
      options.headers = options.headers || {};
      options.headers["X-Cris-Token"] = CRIS_TOKEN;
      if (options.body && typeof options.body === "object") {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.body);
      }
      return await fetch(url, options);
    }

    // Telemetry Polling
    async function updateTelemetry() {
      try {
        const res = await apiFetch("/api/status");
        if (res.ok) {
          const d = await res.json();
          const m = d.metrics || {};
          document.getElementById("stat-cpu").textContent = (m.cpu_percent || 0) + "%";
          document.getElementById("stat-ram").textContent = (m.memory_percent || 0) + "%";
          document.getElementById("stat-battery").textContent = m.battery_percent ? m.battery_percent + "%" : "AC";
          document.getElementById("stat-model").textContent = d.model || "--";
        }
      } catch (e) {}
    }
    setInterval(updateTelemetry, 5000);
    updateTelemetry();

    // Check Approvals Badge
    async function checkApprovals() {
      try {
        const res = await apiFetch("/api/approvals");
        if (res.ok) {
          const list = await res.json();
          approvalsBadge.textContent = list.length;
          approvalsBadge.style.display = list.length > 0 ? "block" : "none";
        }
      } catch (e) {}
    }
    setInterval(checkApprovals, 3000);
    checkApprovals();

    telemetryBtn.addEventListener("click", () => telemetryFlyout.classList.toggle("active"));

    killBtn.addEventListener("click", async () => {
      setState("idle");
      showSubtitle("Emergency kill switch activated. Automation stopped.");
      await apiFetch("/api/kill_switch", { method: "POST" });
    });

    // SIDEBAR WORKSPACE CONTROLLER
    function openSidebar(targetUrl) {
      sidebarPanel.classList.add("open");
      sidebarToggleBtn.classList.add("active");
      if (targetUrl) {
        navigateTo(targetUrl);
      }
    }
    function closeSidebar() {
      sidebarPanel.classList.remove("open");
      sidebarToggleBtn.classList.remove("active");
    }
    function toggleSidebar() {
      if (sidebarPanel.classList.contains("open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    }

    sidebarToggleBtn.addEventListener("click", toggleSidebar);
    sidebarCloseBtn.addEventListener("click", closeSidebar);

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("sidebar") === "1" || urlParams.get("sidebar") === "true") {
      openSidebar();
    }

    function navigateTo(url) {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }
      sidebarUrlInput.value = url;
      sidebarIframe.style.display = "block";
      questHudView.classList.remove("active");
      sidebarIframe.src = url;
    }

    sidebarGoBtn.addEventListener("click", () => navigateTo(sidebarUrlInput.value));
    sidebarUrlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") navigateTo(sidebarUrlInput.value);
    });
    sidebarReloadBtn.addEventListener("click", () => {
      if (sidebarIframe.style.display !== "none") {
        sidebarIframe.src = sidebarIframe.src;
      } else {
        loadQuestHud();
      }
    });
    sidebarPopoutBtn.addEventListener("click", () => window.open(sidebarUrlInput.value, "_blank"));

    tabQuest.addEventListener("click", () => {
      document.querySelectorAll(".side-tab").forEach(t => t.classList.remove("active"));
      tabQuest.classList.add("active");
      navigateTo("http://localhost:5174/");
    });

    tabGoogle.addEventListener("click", () => {
      document.querySelectorAll(".side-tab").forEach(t => t.classList.remove("active"));
      tabGoogle.classList.add("active");
      navigateTo("https://duckduckgo.com");
    });

    tabHud.addEventListener("click", () => {
      document.querySelectorAll(".side-tab").forEach(t => t.classList.remove("active"));
      tabHud.classList.add("active");
      sidebarIframe.style.display = "none";
      questHudView.classList.add("active");
      loadQuestHud();
    });

    // Real-time Quest HUD Loading
    async function loadQuestHud() {
      try {
        const res = await apiFetch("/api/quest/tasks");
        if (res.ok) {
          const d = await res.json();
          const prog = d.progress || {};
          playerRankBadge.textContent = prog.rank_title || "E-Rank Novice";
          playerXpLabel.textContent = (prog.total_xp || 0) + " XP";

          const tasks = d.tasks || [];
          if (!tasks.length) {
            questItemsList.innerHTML = "<p style='color:#64748b;font-size:0.8rem;'>No active quests. Tell Cris: 'Cris, assign a new task: Gym workout, level 3'.</p>";
            return;
          }

          let html = "";
          for (const t of tasks) {
            html += `
              <div class="quest-item ${t.done ? 'done' : ''}">
                <div style="display:flex;align-items:center;gap:0.75rem;">
                  <button class="quest-checkbox ${t.done ? 'checked' : ''}" onclick="toggleQuestDone('${t.id}')">
                    ${t.done ? '✓' : ''}
                  </button>
                  <div>
                    <strong style="color:#fff;font-size:0.85rem;">${t.title}</strong>
                    <div style="font-size:0.7rem;color:#94a3b8;margin-top:2px;">
                      Level ${t.intensity} • +${t.xp} XP ${t.scheduled_at ? '• ' + t.scheduled_at : ''}
                    </div>
                  </div>
                </div>
                <button class="panel-btn danger" style="padding:2px 8px;font-size:0.65rem;" onclick="deleteQuest('${t.id}')">✕</button>
              </div>
            `;
          }
          questItemsList.innerHTML = html;
        }
      } catch (e) {}
    }

    window.toggleQuestDone = async (id) => {
      const res = await apiFetch(`/api/quest/tasks/${id}/complete`, { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        showSubtitle(d.message || "Quest completed!");
        loadQuestHud();
      }
    };

    window.deleteQuest = async (id) => {
      await apiFetch(`/api/quest/tasks/${id}/delete`, { method: "POST" });
      loadQuestHud();
    };

    newQuestModalBtn.addEventListener("click", async () => {
      const title = prompt("Enter Quest Title (e.g. 'Morning workout'):");
      if (!title) return;
      const intensity = parseInt(prompt("Intensity Level (1-5):", "2")) || 2;
      const res = await apiFetch("/api/quest/tasks", {
        method: "POST",
        body: { title, intensity }
      });
      if (res.ok) {
        showSubtitle(`Assigned quest: ${title} (Level ${intensity})`);
        loadQuestHud();
      }
    });

    // Chat / Voice Input Dispatch with Intelligent Sidebar & Quest Integration
    async function sendMessage(text) {
      if (!text.trim()) return;
      chatInput.value = "";
      setState("working");
      showSubtitle("Thinking...");

      try {
        const res = await apiFetch("/api/chat", {
          method: "POST",
          body: { message: text }
        });
        const d = await res.json();

        // 1. Sidebar open/navigation command
        if (d.sidebar) {
          if (d.sidebar.open) {
            openSidebar(d.sidebar.url);
          } else if (d.sidebar.open === false) {
            closeSidebar();
          }
        }

        // 2. Panel open command
        if (d.panel) {
          openPanel(d.panel);
        }

        // 3. Quest updated -> refresh quest HUD
        if (d.quest_assigned || d.quest_completed) {
          loadQuestHud();
        }

        if (d.reply) {
          setState("talking");
          showSubtitle(d.reply);
          setTimeout(() => { setState("idle"); }, 4000);
        } else if (d.error) {
          setState("idle");
          showSubtitle("Error: " + d.error);
        }
      } catch (e) {
        setState("idle");
        showSubtitle("Network error: " + e.message);
      }
    }

    sendBtn.addEventListener("click", () => sendMessage(chatInput.value));
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage(chatInput.value);
    });

    // Global Key Shortcuts: Esc to close panels, Ctrl+B to toggle sidebar
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closePanel();
        closeSidebar();
      }
      if (e.ctrlKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        toggleSidebar();
      }
    });

    coreBtn.addEventListener("click", () => {
      if (currentState === "idle") {
        setState("listening");
        showSubtitle("Listening...");
        setTimeout(() => {
          if (currentState === "listening") {
            setState("idle");
            showSubtitle("Session timed out.");
          }
        }, 5000);
      } else {
        setState("idle");
      }
    });

    function closePanel() {
      modulePanel.classList.remove("open");
      document.querySelectorAll(".dock-btn").forEach(b => b.classList.remove("active"));
    }
    panelClose.addEventListener("click", closePanel);

    async function openPanel(panelId) {
      document.querySelectorAll(".dock-btn").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-panel") === panelId);
      });
      panelTitle.textContent = panelId.toUpperCase().replace("_", " ");
      panelBody.innerHTML = "<p>Loading...</p>";
      modulePanel.classList.add("open");

      if (panelId === "tasks") loadTasksPanel();
      else if (panelId === "approvals") loadApprovalsPanel();
      else if (panelId === "web_agent") loadWebAgentPanel();
      else if (panelId === "notes") loadNotesPanel();
      else if (panelId === "files") loadFilesPanel();
      else if (panelId === "google") loadGooglePanel();
      else if (panelId === "github") loadGithubPanel();
      else if (panelId === "memory") loadMemoryPanel();
      else if (panelId === "skills") loadSkillsPanel();
      else if (panelId === "logs") loadLogsPanel();
      else if (panelId === "settings") loadSettingsPanel();
    }

    document.querySelectorAll(".dock-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-panel");
        openPanel(id);
      });
    });

    // Panel Loaders
    async function loadTasksPanel() {
      const res = await apiFetch("/api/tasks");
      const list = await res.json();
      if (!list.length) {
        panelBody.innerHTML = `
          <div class="panel-card"><p>No tasks in queue.</p></div>
          <div style="display:flex;gap:0.5rem;">
            <input type="text" id="new-task-goal" placeholder="New multi-step goal..." style="flex:1;background:#1e293b;border:1px solid #334155;color:#fff;padding:6px;border-radius:4px;">
            <button class="panel-btn" id="run-task-btn">Run</button>
          </div>
        `;
        document.getElementById("run-task-btn")?.addEventListener("click", () => {
          const val = document.getElementById("new-task-goal").value;
          if (val) apiFetch("/api/tasks/run", { method: "POST", body: { goal: val } }).then(() => loadTasksPanel());
        });
        return;
      }
      let html = "";
      for (const t of list) {
        html += `
          <div class="panel-card">
            <div style="display:flex;justify-content:space-between;">
              <strong>${t.goal}</strong>
              <span style="color:var(--gold);text-transform:uppercase;">${t.status}</span>
            </div>
            <p style="font-size:0.75rem;color:#94a3b8;">Steps: ${t.current_step}/${t.steps.length}</p>
            <div style="display:flex;gap:0.5rem;margin-top:0.4rem;">
              <button class="panel-btn" onclick="pauseTask('${t.id}')">Pause</button>
              <button class="panel-btn" onclick="resumeTask('${t.id}')">Resume</button>
              <button class="panel-btn danger" onclick="cancelTask('${t.id}')">Stop</button>
            </div>
            <div style="background:#000;padding:6px;border-radius:4px;font-size:0.7rem;max-height:100px;overflow-y:auto;margin-top:6px;">
              ${(t.logs || []).slice(-5).map(l => `<div>${l}</div>`).join("")}
            </div>
          </div>
        `;
      }
      panelBody.innerHTML = html;
    }
    window.pauseTask = (id) => apiFetch(`/api/tasks/${id}/pause`, { method: "POST" }).then(() => loadTasksPanel());
    window.resumeTask = (id) => apiFetch(`/api/tasks/${id}/resume`, { method: "POST" }).then(() => loadTasksPanel());
    window.cancelTask = (id) => apiFetch(`/api/tasks/${id}/cancel`, { method: "POST" }).then(() => loadTasksPanel());

    async function loadApprovalsPanel() {
      const res = await apiFetch("/api/approvals");
      const list = await res.json();
      if (!list.length) {
        panelBody.innerHTML = "<div class='panel-card'><p>No pending approvals. All actions secure.</p></div>";
        return;
      }
      let html = "";
      for (const a of list) {
        html += `
          <div class="panel-card">
            <strong>${a.action}</strong>
            <p style="font-size:0.75rem;color:#94a3b8;">Source: ${a.source || 'system'}</p>
            ${a.screenshot_path ? `<img src="/api/screenshot?path=${encodeURIComponent(a.screenshot_path)}" style="width:100%;border-radius:4px;margin-top:6px;">` : ''}
            <div style="display:flex;gap:0.5rem;margin-top:0.6rem;">
              <button class="panel-btn" onclick="respondApproval('${a.id}', true)">Approve</button>
              <button class="panel-btn danger" onclick="respondApproval('${a.id}', false)">Deny</button>
            </div>
          </div>
        `;
      }
      panelBody.innerHTML = html;
    }
    window.respondApproval = (id, approve) => {
      apiFetch(`/api/approvals/${id}/respond`, { method: "POST", body: { approve } }).then(() => {
        loadApprovalsPanel();
        checkApprovals();
      });
    };

    async function loadWebAgentPanel() {
      panelBody.innerHTML = `
        <div class="panel-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>Live Browser View</strong>
            <button class="panel-btn" id="takeover-btn">Take Over</button>
          </div>
          <div style="background:#0f172a;min-height:200px;border-radius:6px;display:flex;align-items:center;justify-content:center;margin-top:8px;">
            <img src="/api/web_agent/screenshot" onerror="this.style.display='none'" style="width:100%;border-radius:6px;">
          </div>
        </div>
      `;
      document.getElementById("takeover-btn")?.addEventListener("click", () => {
        apiFetch("/api/web_agent/takeover", { method: "POST" });
        showSubtitle("Manual browser takeover requested.");
      });
    }

    async function loadNotesPanel() {
      const res = await apiFetch("/api/productivity/notes");
      const list = await res.json();
      let html = "<div style='display:flex;justify-content:space-between;'><button class='panel-btn' onclick='addQuickNote()'>+ Add Note</button></div>";
      for (const n of list) {
        html += `<div class="panel-card"><strong>${n.title}</strong><p>${n.content}</p></div>`;
      }
      panelBody.innerHTML = html || "<p>No notes found.</p>";
    }
    window.addQuickNote = () => {
      const t = prompt("Note Title:");
      const c = prompt("Content:");
      if (t && c) apiFetch("/api/productivity/notes", { method: "POST", body: { title: t, content: c } }).then(() => loadNotesPanel());
    };

    async function loadFilesPanel() {
      const res = await apiFetch("/api/files");
      const data = await res.json();
      panelBody.innerHTML = `
        <div class="panel-card">
          <strong>Allowed Roots</strong>
          <ul style="padding-left:1.2rem;margin-top:4px;font-size:0.75rem;">
            ${(data.allowed_roots || []).map(r => `<li>${r}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    async function loadGooglePanel() {
      const res = await apiFetch("/api/google/agenda");
      const data = await res.json();
      panelBody.innerHTML = `
        <div class="panel-card">
          <strong>Upcoming Calendar Events</strong>
          <p style="font-size:0.8rem;margin-top:4px;">${data.events ? JSON.stringify(data.events) : 'No upcoming events.'}</p>
        </div>
      `;
    }

    async function loadGithubPanel() {
      panelBody.innerHTML = `
        <div class="panel-card">
          <strong>Recent Repositories & Builds</strong>
          <p style="font-size:0.8rem;margin-top:4px;">Connected via GitHub Client. Use voice/chat to push or deploy.</p>
        </div>
      `;
    }

    async function loadMemoryPanel() {
      const res = await apiFetch("/api/memory");
      const facts = await res.json();
      let html = "";
      for (const f of facts) {
        html += `
          <div class="panel-card" style="display:flex;flex-direction:row;justify-content:space-between;align-items:center;">
            <div><strong>${f.key}</strong>: <span>${f.value}</span></div>
            <button class="panel-btn danger" onclick="deleteFact('${f.key}')">Delete</button>
          </div>
        `;
      }
      panelBody.innerHTML = html || "<p>No stored facts in memory.</p>";
    }
    window.deleteFact = (k) => apiFetch(`/api/memory/delete`, { method: "POST", body: { key: k } }).then(() => loadMemoryPanel());

    async function loadSkillsPanel() {
      const res = await apiFetch("/api/skills");
      const data = await res.json();
      let html = "<strong>Pending Review</strong>";
      if (!data.pending.length) {
        html += "<p style='font-size:0.75rem;color:#94a3b8;'>No pending skills.</p>";
      } else {
        for (const s of data.pending) {
          html += `
            <div class="panel-card">
              <strong>${s.name}</strong>
              <p style="font-size:0.75rem;color:#94a3b8;">${s.description}</p>
              <button class="panel-btn" onclick="approveSkill('${s.id}')">Approve Skill</button>
            </div>
          `;
        }
      }
      html += "<strong style='margin-top:1rem;display:block;'>Active Skills</strong>";
      for (const a of data.active) {
        html += `<div class="panel-card"><strong>${a.name}</strong><p style="font-size:0.75rem;color:#94a3b8;">${a.description}</p></div>`;
      }
      panelBody.innerHTML = html;
    }
    window.approveSkill = (id) => apiFetch(`/api/skills/approve`, { method: "POST", body: { id } }).then(() => loadSkillsPanel());

    async function loadLogsPanel() {
      const res = await apiFetch("/api/logs");
      const logs = await res.json();
      panelBody.innerHTML = `
        <div style="background:#000;padding:10px;border-radius:6px;font-family:var(--font-mono);font-size:0.7rem;max-height:400px;overflow-y:auto;">
          ${logs.map(l => `<div>${l}</div>`).join("")}
        </div>
      `;
    }

    async function loadSettingsPanel() {
      const res = await apiFetch("/api/settings");
      const d = await res.json();
      panelBody.innerHTML = `
        <div class="panel-card">
          <strong>Per-Role Models</strong>
          <p style="font-size:0.75rem;">Chat: <span style="color:var(--gold);">${d.model_chat}</span></p>
          <p style="font-size:0.75rem;">Planner: <span style="color:var(--gold);">${d.model_planner}</span></p>
          <p style="font-size:0.75rem;">Browser Agent: <span style="color:var(--gold);">${d.model_browser_agent}</span></p>
        </div>
        <div class="panel-card">
          <strong>Voice Settings</strong>
          <p style="font-size:0.75rem;">Wake Word: ${d.wake_word}</p>
          <p style="font-size:0.75rem;">Silence Timeout: ${d.silence_timeout}s</p>
          <p style="font-size:0.75rem;">Mode: ${d.mode}</p>
        </div>
      `;
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
    gate: ConfirmationGate = None
    task_runner: TaskRunner = None
    scheduler: BackgroundScheduler = None
    logs: list[str] = []

    def _send_json(self, data: Any, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def _send_unauthorized(self) -> None:
        self.send_response(401)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"error": "Unauthorized: valid token required"}).encode("utf-8"))

    def _send_forbidden(self, msg: str = "Forbidden") -> None:
        self.send_response(403)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"error": msg}).encode("utf-8"))

    def do_GET(self):
        # 1. Validate Host & Origin
        headers_dict = {k: v for k, v in self.headers.items()}
        if not check_origin_and_host(headers_dict):
            self._send_forbidden("Host or Origin validation failed (anti-CSRF/anti-DNS rebinding).")
            return

        parsed = urlparse(self.path)
        path = parsed.path

        # 2. Main Page Shell
        if path in ("/", "/index.html"):
            if not validate_token(headers_dict, self.path, LAUNCH_TOKEN):
                self._send_unauthorized()
                return
            html = HTML_PAGE.replace("__CRIS_TOKEN_PLACEHOLDER__", LAUNCH_TOKEN)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html.encode("utf-8"))
            return

        # 3. All API routes require token validation
        if not validate_token(headers_dict, self.path, LAUNCH_TOKEN):
            self._send_unauthorized()
            return

        if path == "/api/status":
            sys_info = system_status.execute()
            self._send_json({
                "status": "online",
                "model": self.config.gemini_model,
                "metrics": sys_info.get("metrics", {})
            })
            return

        elif path == "/api/quest/tasks":
            tasks = self.store.list_quest_tasks()
            progress = self.store.get_player_progress()
            self._send_json({"tasks": tasks, "progress": progress})
            return

        elif path == "/api/approvals":
            pending = self.gate.list_pending_requests()
            self._send_json(pending)
            return

        elif path == "/api/tasks":
            tasks = self.store.list_queue_tasks(limit=15)
            self._send_json(tasks)
            return

        elif path == "/api/productivity/notes":
            notes = self.store.search_notes()
            self._send_json(notes)
            return

        elif path == "/api/files":
            self._send_json({"allowed_roots": self.config.allowed_roots})
            return

        elif path == "/api/google/agenda":
            try:
                from integrations.google import calendar_tool
                events = calendar_tool.execute(action="list")
                self._send_json(events)
            except Exception as e:
                self._send_json({"events": [], "error": str(e)})
            return

        elif path == "/api/memory":
            facts = self.store.list_facts()
            self._send_json(facts)
            return

        elif path == "/api/skills":
            active = self.scheduler.list_active_skills() if self.scheduler else []
            pending = self.scheduler.list_pending_skills() if self.scheduler else []
            self._send_json({"active": active, "pending": pending})
            return

        elif path == "/api/logs":
            self._send_json(self.logs[-50:])
            return

        elif path == "/api/settings":
            self._send_json({
                "model_chat": getattr(self.config, "model_chat", self.config.gemini_model),
                "model_planner": getattr(self.config, "model_planner", self.config.gemini_model),
                "model_browser_agent": getattr(self.config, "model_browser_agent", self.config.gemini_model),
                "wake_word": self.config.voice.wake_word_phrase,
                "silence_timeout": self.config.voice.silence_timeout_seconds,
                "mode": self.config.mode
            })
            return

        self.send_error(404, "Not Found")

    def do_POST(self):
        # 1. Validate Host & Origin
        headers_dict = {k: v for k, v in self.headers.items()}
        if not check_origin_and_host(headers_dict):
            self._send_forbidden("Host or Origin validation failed.")
            return

        # 2. Token validation
        if not validate_token(headers_dict, self.path, LAUNCH_TOKEN):
            self._send_unauthorized()
            return

        length = int(self.headers.get("Content-Length", 0))
        body_raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            body = json.loads(body_raw)
        except Exception:
            body = {}

        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/kill_switch":
            KillSwitch.get_instance().trigger()
            self.logs.append("[KILL SWITCH] Emergency abort triggered via UI")
            self._send_json({"status": "aborted"})
            return

        elif path == "/api/quest/tasks":
            title = body.get("title", "").strip()
            intensity = int(body.get("intensity", 2))
            scheduled_at = body.get("scheduled_at")
            timer_minutes = body.get("timer_minutes")
            res = quest_tool.execute(
                action="assign",
                title=title,
                intensity=intensity,
                scheduled_at=scheduled_at,
                timer_minutes=timer_minutes,
                store=self.store
            )
            self.logs.append(f"[QUEST] Assigned task: {title} (Level {intensity})")
            self._send_json(res)
            return

        elif path.startswith("/api/quest/tasks/") and path.endswith("/complete"):
            task_id = path.split("/")[4]
            res = quest_tool.execute(action="complete", task_id=task_id, store=self.store)
            self.logs.append(f"[QUEST] Completed task: {task_id}")
            self._send_json(res)
            return

        elif path.startswith("/api/quest/tasks/") and path.endswith("/delete"):
            task_id = path.split("/")[4]
            res = quest_tool.execute(action="delete", task_id=task_id, store=self.store)
            self.logs.append(f"[QUEST] Deleted task: {task_id}")
            self._send_json(res)
            return

        elif path == "/api/download_image":
            query = body.get("query", "")
            filename = body.get("filename")
            res = image_downloader.execute(query=query, filename=filename)
            self.logs.append(f"[DOWNLOAD] Image: {query}")
            self._send_json(res)
            return

        elif path == "/api/chat":
            user_msg = body.get("message", "").strip()
            if not user_msg:
                self._send_json({"error": "Empty message"}, status=400)
                return

            self.logs.append(f"[CHAT] User: {user_msg}")
            lower = user_msg.lower()

            # 1. Sidebar open / close / navigate voice & text intent
            if re.search(r"\b(open\s+(?:the\s+)?sidebar|সাইডবার\s+খোলো)\b", lower):
                # Check if specific website/url mentioned: e.g. "open sidebar and go to quest app"
                target_url = "http://localhost:5174/"
                url_match = re.search(r"(?:go\s+to|visit)\s+([^\s]+)", lower)
                if url_match:
                    raw_u = url_match.group(1).strip()
                    if "quest" in raw_u:
                        target_url = "http://localhost:5174/"
                    elif "google" in raw_u:
                        target_url = "https://duckduckgo.com"
                    elif raw_u.startswith("http"):
                        target_url = raw_u
                    else:
                        target_url = f"https://{raw_u}"

                self._send_json({
                    "sidebar": {"open": True, "url": target_url},
                    "reply": f"Opening sidebar workspace and navigating to {target_url}."
                })
                return

            if re.search(r"\b(close\s+(?:the\s+)?sidebar|সাইডবার\s+বন্ধ\s*করো)\b", lower):
                self._send_json({
                    "sidebar": {"open": False},
                    "reply": "Sidebar workspace closed."
                })
                return

            # Direct navigation: "cris, go to <website>"
            nav_match = re.search(r"^(?:cris,?\s*)?(?:go\s+to|visit)\s+([^\s,]+)", lower)
            if nav_match and not any(kw in lower for kw in ("google and download", "file manager")):
                dest = nav_match.group(1).strip()
                if "quest" in dest:
                    target_url = "http://localhost:5174/"
                elif "google" in dest:
                    target_url = "https://duckduckgo.com"
                elif dest.startswith("http"):
                    target_url = dest
                else:
                    target_url = f"https://{dest}"

                self._send_json({
                    "sidebar": {"open": True, "url": target_url},
                    "reply": f"Navigating to {target_url} in the sidebar workspace."
                })
                return

            # Check if user asked to open a specific module panel by voice/text
            open_panel_match = re.search(r"(?:open|show|খোলো|দেখাও)\s+(tasks|approvals|web agent|notes|files|google|github|memory|skills|logs|settings)", user_msg, re.IGNORECASE)
            if open_panel_match:
                panel_name = open_panel_match.group(1).lower().replace(" ", "_")
                self._send_json({"panel": panel_name, "reply": f"Opening {panel_name.replace('_', ' ')}."})
                return

            # Execute tool directly if matched (app builder, quest assign/complete, download picture, file delete)
            from main import execute_potential_tools
            direct = execute_potential_tools(user_msg, self.registry)
            if direct:
                reply = direct
                quest_flag = "quest" in lower or "টাস্ক" in lower
                self.logs.append(f"[DIRECT ACTION]: {direct[:100]}")
                self._send_json({"reply": reply, "quest_assigned": quest_flag, "quest_completed": quest_flag})
                return
            else:
                lang = detect_language(user_msg)
                facts = self.store.list_facts()
                facts_str = "\n".join([f"- {f['key']}: {f['value']}" for f in facts]) if facts else ""
                prompt = get_system_prompt(language=lang, facts_context=facts_str)
                model_name = getattr(self.config, "model_chat", self.config.gemini_model)
                reply = self.llm.generate(prompt=user_msg, system_prompt=prompt, model_override=model_name)

            self.logs.append(f"[CHAT] Cris: {reply[:100]}...")
            self._send_json({"reply": reply})
            return

        elif path == "/api/tasks/run":
            goal = body.get("goal", "").strip()
            if not goal:
                self._send_json({"error": "No goal specified"}, status=400)
                return
            task_id = self.task_runner.start_task(goal)
            self.logs.append(f"[TASK] Started task {task_id}: {goal}")
            self._send_json({"task_id": task_id, "status": "started"})
            return

        elif path.startswith("/api/tasks/") and path.endswith("/pause"):
            task_id = path.split("/")[3]
            self.task_runner.pause_task(task_id)
            self._send_json({"task_id": task_id, "status": "paused"})
            return

        elif path.startswith("/api/tasks/") and path.endswith("/resume"):
            task_id = path.split("/")[3]
            self.task_runner.resume_task(task_id)
            self._send_json({"task_id": task_id, "status": "resumed"})
            return

        elif path.startswith("/api/tasks/") and path.endswith("/cancel"):
            task_id = path.split("/")[3]
            self.task_runner.cancel_task(task_id)
            self._send_json({"task_id": task_id, "status": "cancelled"})
            return

        elif path.startswith("/api/approvals/") and path.endswith("/respond"):
            req_id = path.split("/")[3]
            approve = bool(body.get("approve", False))
            success = self.gate.resolve_request(req_id, approve=approve, source="authenticated_ui")
            self.logs.append(f"[APPROVAL] Request {req_id} {'Approved' if approve else 'Denied'} via Authenticated UI")
            self._send_json({"success": success})
            return

        elif path == "/api/memory/delete":
            k = body.get("key")
            if k:
                self.store.delete_fact(k)
            self._send_json({"success": True})
            return

        elif path == "/api/skills/approve":
            skill_id = body.get("id")
            if skill_id and self.scheduler:
                self.scheduler.approve_skill(skill_id)
            self._send_json({"success": True})
            return

        self.send_error(404, "Not Found")


def run_server(port: int = 8000):
    config = load_config()
    store = SQLiteStore(config.sqlite_db_path)
    llm = ResilientLLMClient(config)
    gate = ConfirmationGate.get_instance()

    from main import create_tool_registry
    registry = create_tool_registry(gate)

    task_runner = TaskRunner(config, store, llm, registry, gate)
    scheduler = BackgroundScheduler(config, store, registry, gate)
    scheduler.start()

    CrisWebHandler.config = config
    CrisWebHandler.store = store
    CrisWebHandler.llm = llm
    CrisWebHandler.registry = registry
    CrisWebHandler.gate = gate
    CrisWebHandler.task_runner = task_runner
    CrisWebHandler.scheduler = scheduler

    server = ThreadingHTTPServer((BIND_HOST, port), CrisWebHandler)
    auth_url = f"http://{BIND_HOST}:{port}/?token={LAUNCH_TOKEN}"
    print(f"\n=======================================================")
    print(f" Cris Hardened Core Server (127.0.0.1 only)")
    print(f" Authenticated HUD URL: {auth_url}")
    print(f" Ephemeral Launch Token: {LAUNCH_TOKEN}")
    print(f"=======================================================\n")
    server.serve_forever()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)
