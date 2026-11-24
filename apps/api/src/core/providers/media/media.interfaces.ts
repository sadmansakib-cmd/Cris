/**
 * Phase 12 (Voice) + Phase 13 (Vision) provider interfaces.
 * Concrete impls: whisper.cpp / OpenAI (STT), piper / ElevenLabs (TTS),
 * porcupine (wake word), tesseract / cloud OCR, yolo / cloud detection.
 */
export interface SpeechToText {
  transcribe(audio: Buffer, opts?: { language?: string; model?: string }): Promise<{ text: string; segments?: Array<{ start: number; end: number; text: string }> }>;
}

export interface TextToSpeech {
  synthesize(text: string, opts?: { voice?: string; format?: 'mp3' | 'wav' | 'ogg' }): Promise<Buffer>;
  stream?(text: string, opts?: { voice?: string }): AsyncGenerator<Buffer>;
}

export interface WakeWord {
  start(word: string, onDetected: () => void): Promise<() => void>; // returns stop()
}

export interface OcrProvider {
  extract(image: Buffer, opts?: { lang?: string }): Promise<{ text: string; boxes?: Array<{ x: number; y: number; w: number; h: number; text: string; conf: number }> }>;
}

export interface DetectionProvider {
  detect(image: Buffer, opts?: { classes?: string[] }): Promise<Array<{ class: string; conf: number; box: { x: number; y: number; w: number; h: number } }>>;
}
