"""
Cris Agent - Google OAuth2 Authentication Handler
Handles desktop OAuth2 flow and stores user credentials strictly in gitignored tokens directory.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional
from config import AppConfig
from core.config_loader import load_config

logger = logging.getLogger("cris.google_auth")

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/drive.readonly"
]


def get_google_credentials(config: Optional[AppConfig] = None) -> Optional[Any]:
    if config is None:
        config = load_config()

    token_file = config.google_token_file
    cred_file = config.google_credentials_file

    try:
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from google.auth.transport.requests import Request
    except ImportError:
        logger.info("google-auth packages not installed. Install via requirements.txt.")
        return None

    creds = None
    if token_file.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(token_file), SCOPES)
        except Exception as e:
            logger.warning(f"Error loading existing token: {e}")

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                with open(token_file, "w", encoding="utf-8") as token_out:
                    token_out.write(creds.to_json())
                return creds
            except Exception as e:
                logger.warning(f"Failed to refresh Google token: {e}")

        # Start desktop authorization flow if credentials.json is provided
        if cred_file.exists():
            try:
                flow = InstalledAppFlow.from_client_secrets_file(str(cred_file), SCOPES)
                creds = flow.run_local_server(port=0)
                with open(token_file, "w", encoding="utf-8") as token_out:
                    token_out.write(creds.to_json())
                return creds
            except Exception as e:
                logger.error(f"OAuth flow failed: {e}")
                return None
        else:
            logger.debug(f"Google credentials file not found at {cred_file}")
            return None

    return creds
