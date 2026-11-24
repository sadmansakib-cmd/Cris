# Phase 12 (Voice) + Phase 13 (Vision)

Core `MediaModule` exposes `/media/stt`, `/media/tts`, `/media/ocr`, `/media/detect` behind JWT with `AuditService` logging.

Providers (all pluggable via env `{STT|TTS|OCR|VISION}_DEFAULT_PROVIDER`):

- `OpenAIAudioProvider` — Whisper STT + `tts-1` TTS (voice + format selectable).
- `TesseractOcrProvider` — `tesseract.js` OCR with per-word bounding boxes; zero native deps.
- `AiVisionDetectionProvider` — multimodal AI-backed object detection using the registered AI provider; returns `{ class, conf, box }` list.
- Interfaces from `providers/media/media.interfaces.ts` remain the plug points for whisper.cpp / piper / porcupine / YOLO / ONNX later.

Web `Voice & Vision` page (sidebar, `Mic` icon) records mic audio → Whisper, plays synthesized TTS audio inline, and runs OCR / detection on any uploaded image.

Runtime dep for the API worker: `tesseract.js`.
