import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DetectionProvider, OcrProvider, SpeechToText, TextToSpeech } from '../providers/media/media.interfaces';
import { OpenAIAudioProvider } from '../providers/media/openai-audio.provider';
import { TesseractOcrProvider } from '../providers/media/tesseract-ocr.provider';
import { AiVisionDetectionProvider } from '../providers/media/ai-vision.provider';
import { ProviderRegistry } from '../providers/providers.module';
import { AuditService } from '../audit/audit.service';

/**
 * Voice + Vision service. Providers are pluggable; env picks the default.
 *   STT_DEFAULT_PROVIDER=openai|whisper-local
 *   TTS_DEFAULT_PROVIDER=openai|piper
 *   OCR_DEFAULT_PROVIDER=tesseract|cloud
 *   VISION_DEFAULT_PROVIDER=ai-vision|yolo
 */
@Injectable()
export class MediaService {
  private readonly log = new Logger(MediaService.name);
  private readonly stts = new Map<string, SpeechToText>();
  private readonly ttss = new Map<string, TextToSpeech>();
  private readonly ocrs = new Map<string, OcrProvider>();
  private readonly detectors = new Map<string, DetectionProvider>();

  constructor(
    private readonly config: ConfigService,
    private readonly providers: ProviderRegistry,
    private readonly audit: AuditService,
  ) {
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      const audio = new OpenAIAudioProvider(openaiKey);
      this.stts.set('openai', audio);
      this.ttss.set('openai', audio);
    }
    this.ocrs.set('tesseract', new TesseractOcrProvider());
  }

  private pickStt() {
    const key = this.config.get<string>('STT_DEFAULT_PROVIDER') ?? 'openai';
    const p = this.stts.get(key);
    if (!p) throw new Error(`STT provider "${key}" not configured`);
    return p;
  }
  private pickTts() {
    const key = this.config.get<string>('TTS_DEFAULT_PROVIDER') ?? 'openai';
    const p = this.ttss.get(key);
    if (!p) throw new Error(`TTS provider "${key}" not configured`);
    return p;
  }
  private pickOcr() {
    const key = this.config.get<string>('OCR_DEFAULT_PROVIDER') ?? 'tesseract';
    const p = this.ocrs.get(key);
    if (!p) throw new Error(`OCR provider "${key}" not configured`);
    return p;
  }
  private pickDetector(userId: string) {
    const key = this.config.get<string>('VISION_DEFAULT_PROVIDER') ?? 'ai-vision';
    if (this.detectors.has(key)) return this.detectors.get(key)!;
    if (key === 'ai-vision') {
      const ai = this.providers.get('ai');
      return new AiVisionDetectionProvider(ai as any, userId);
    }
    throw new Error(`Vision provider "${key}" not configured`);
  }

  async stt(userId: string, audio: Buffer, language?: string) {
    const out = await this.pickStt().transcribe(audio, { language });
    await this.audit.record({ userId, action: 'media.stt', meta: { bytes: audio.length, language } } as any);
    return out;
  }
  async tts(userId: string, text: string, voice?: string, format?: 'mp3' | 'wav' | 'ogg') {
    const buf = await this.pickTts().synthesize(text, { voice, format });
    await this.audit.record({ userId, action: 'media.tts', meta: { chars: text.length, voice } } as any);
    return buf;
  }
  async ocr(userId: string, image: Buffer, lang?: string) {
    const out = await this.pickOcr().extract(image, { lang });
    await this.audit.record({ userId, action: 'media.ocr', meta: { bytes: image.length, lang } } as any);
    return out;
  }
  async detect(userId: string, image: Buffer, classes?: string[]) {
    const out = await this.pickDetector(userId).detect(image, { classes });
    await this.audit.record({ userId, action: 'media.detect', meta: { bytes: image.length, classes } } as any);
    return out;
  }
}
