import type { SpeechToText, TextToSpeech } from './media.interfaces';

/** OpenAI Whisper STT + TTS. */
export class OpenAIAudioProvider implements SpeechToText, TextToSpeech {
  readonly id = 'openai-audio';
  constructor(private readonly apiKey: string) {}

  async transcribe(audio: Buffer, opts?: { language?: string; model?: string }) {
    const form = new FormData();
    form.append('file', new Blob([audio as any], { type: 'audio/webm' }), 'audio.webm');
    form.append('model', opts?.model ?? 'whisper-1');
    if (opts?.language) form.append('language', opts.language);
    form.append('response_format', 'verbose_json');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`whisper ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { text: string; segments?: any[] };
    return {
      text: data.text,
      segments: data.segments?.map((s) => ({ start: s.start, end: s.end, text: s.text })),
    };
  }

  async synthesize(text: string, opts?: { voice?: string; format?: 'mp3' | 'wav' | 'ogg' }) {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'tts-1',
        voice: opts?.voice ?? 'alloy',
        input: text,
        response_format: opts?.format ?? 'mp3',
      }),
    });
    if (!res.ok) throw new Error(`tts ${res.status}: ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
