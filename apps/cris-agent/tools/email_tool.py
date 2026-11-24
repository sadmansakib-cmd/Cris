"""
Cris Agent - Unified Email Tool
Sends emails via local or production SMTP, or Gmail.
Strictly requires explicit confirmation through ConfirmationGate.
"""

from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Optional

from config import AppConfig
from core.config_loader import load_config

TOOL_NAME = "send_email"
TOOL_DESC = "Send an email message via SMTP or Gmail. Strictly requires user confirmation."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "to": {
            "type": "string",
            "description": "Recipient email address."
        },
        "subject": {
            "type": "string",
            "description": "Email subject line."
        },
        "body": {
            "type": "string",
            "description": "Email body content."
        }
    },
    "required": ["to", "subject", "body"]
}
REQUIRES_CONFIRMATION = True


def CONFIRMATION_DESCRIPTION_FN(args: Dict[str, Any]) -> str:
    return f"Send email to '{args.get('to')}' with subject '{args.get('subject')}'"


def execute(to: str, subject: str, body: str, config: Optional[AppConfig] = None) -> Dict[str, Any]:
    if config is None:
        config = load_config()

    if not to or not subject:
        return {"success": False, "error": "Recipient 'to' and 'subject' are required."}

    smtp_host = os.getenv("SMTP_HOST", "localhost")
    smtp_port = int(os.getenv("SMTP_PORT", "1025"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    email_from = os.getenv("EMAIL_FROM", "cris@localhost")

    # Attempt SMTP dispatch
    try:
        msg = MIMEMultipart()
        msg["From"] = email_from
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))

        server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()

        return {
            "success": True,
            "to": to,
            "subject": subject,
            "sender": email_from,
            "message": f"Email successfully dispatched to {to} via SMTP ({smtp_host}:{smtp_port})."
        }
    except Exception as smtp_err:
        # Fallback to Gmail tool if available
        try:
            from integrations.google import gmail_tool
            return gmail_tool.execute("send", to=to, subject=subject, body=body, config=config)
        except Exception:
            return {
                "success": False,
                "error": f"Failed to send email via SMTP ({smtp_err}). Ensure your SMTP server or Gmail credentials are configured."
            }
