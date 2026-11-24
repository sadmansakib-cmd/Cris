"""
Tests for Personality and Language Detection.
"""

from core.personality import detect_language, get_system_prompt


def test_detect_language():
    # Bengali phrases
    assert detect_language("সব কিছু ঠিক আছে?") == "bn"
    assert detect_language("আজকের আবহাওয়া কেমন?") == "bn"
    assert detect_language("হ্যালো ক্রিস") == "bn"

    # English phrases
    assert detect_language("What is the weather today?") == "en"
    assert detect_language("Open notepad and write notes.") == "en"
    assert detect_language("Cris, how are you?") == "en"


def test_system_prompt_structure():
    bn_prompt = get_system_prompt(language="bn", facts_context="User loves Python")
    assert "Bengali" in bn_prompt
    assert "UNTRUSTED DATA" in bn_prompt
    assert "User loves Python" in bn_prompt

    en_prompt = get_system_prompt(language="en")
    assert "English" in en_prompt
    assert "calm" in en_prompt.lower()
    assert "wit" in en_prompt.lower()
