import type { OcrProvider } from './media.interfaces';

/** Tesseract.js OCR — pure JS, works on the server without native deps. */
export class TesseractOcrProvider implements OcrProvider {
  readonly id = 'tesseract';

  async extract(image: Buffer, opts?: { lang?: string }) {
    // Lazy import so the worker only spins up on demand.
    const { createWorker } = (await import('tesseract.js')) as any;
    const worker = await createWorker(opts?.lang ?? 'eng');
    try {
      const { data } = await worker.recognize(image);
      return {
        text: data.text,
        boxes: (data.words || []).map((w: any) => ({
          x: w.bbox.x0,
          y: w.bbox.y0,
          w: w.bbox.x1 - w.bbox.x0,
          h: w.bbox.y1 - w.bbox.y0,
          text: w.text,
          conf: w.confidence,
        })),
      };
    } finally {
      await worker.terminate();
    }
  }
}
