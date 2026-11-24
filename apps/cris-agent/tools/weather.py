"""
Cris Agent - Weather Tool
Fetches live weather forecasts using Open-Meteo's open public API (no API key required).
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any, Dict

TOOL_NAME = "weather"
TOOL_DESC = "Get current weather conditions and forecast for any city or location using Open-Meteo."
TOOL_PARAMS = {
    "type": "object",
    "properties": {
        "location": {
            "type": "string",
            "description": "City or location name (e.g. 'Dhaka', 'London', 'New York')."
        }
    },
    "required": ["location"]
}
REQUIRES_CONFIRMATION = False


def execute(location: str) -> Dict[str, Any]:
    try:
        # Step 1: Geocoding
        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={urllib.parse.quote_plus(location)}&count=1&language=en&format=json"
        req = urllib.request.Request(geo_url, headers={"User-Agent": "CrisAgent/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            geo_data = json.loads(resp.read().decode("utf-8"))

        results = geo_data.get("results")
        if not results:
            return {"success": False, "error": f"Could not find coordinates for location '{location}'."}

        top = results[0]
        lat = top["latitude"]
        lon = top["longitude"]
        place_name = f"{top.get('name')}, {top.get('country', '')}"

        # Step 2: Forecast
        weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=auto"
        req = urllib.request.Request(weather_url, headers={"User-Agent": "CrisAgent/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            weather_data = json.loads(resp.read().decode("utf-8"))

        current = weather_data.get("current", {})

        return {
            "success": True,
            "location": place_name,
            "latitude": lat,
            "longitude": lon,
            "temperature_celsius": current.get("temperature_2m"),
            "apparent_temperature_celsius": current.get("apparent_temperature"),
            "humidity_percent": current.get("relative_humidity_2m"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "is_day": bool(current.get("is_day", 1)),
            "summary": f"Weather in {place_name}: {current.get('temperature_2m')}°C (Feels like {current.get('apparent_temperature')}°C), Wind {current.get('wind_speed_10m')} km/h, Humidity {current.get('relative_humidity_2m')}%."
        }
    except Exception as e:
        return {"success": False, "error": f"Weather lookup failed: {e}"}
