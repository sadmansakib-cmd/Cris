import type { DetectionProvider } from './media.interfaces';

/**
 * Multimodal AI-backed object detection. Delegates to any AI provider
 * that accepts vision input; returns bounding boxes as reported by the model.
 * Prefer YOLO/ONNX for latency-sensitive workloads; this is the zero-setup path.
 */
export class AiVisionDetectionProvider implements DetectionProvider {
  readonly id = 'ai-vision';
  constructor(
    private readonly ai: {
      complete(req: {
        model?: string;
        messages: Array<{ role: string; content: any }>;
        user: { id: string };
      }): Promise<{ text: string }>;
    },
    private readonly userId: string,
  ) {}

  async detect(image: Buffer, opts?: { classes?: string[] }) {
    const b64 = image.toString('base64');
    const prompt = [
      'Detect objects in this image and reply with pure JSON of the form',
      '{"objects":[{"class":string,"conf":0..1,"box":{"x":px,"y":px,"w":px,"h":px}}]}.',
      opts?.classes?.length ? `Only report: ${opts.classes.join(', ')}.` : 'Report the salient objects.',
    ].join(' ');
    const out = await this.ai.complete({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
          ],
        },
      ],
      user: { id: this.userId },
    });
    try {
      const json = JSON.parse(out.text.match(/\{[\s\S]*\}$/)?.[0] ?? out.text);
      return json.objects ?? [];
    } catch {
      return [];
    }
  }
}
