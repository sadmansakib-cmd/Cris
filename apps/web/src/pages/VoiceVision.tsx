import { useRef, useState } from 'react';
import { apiFetch, API_BASE } from '../lib/api';

type Tab = 'voice' | 'vision';

export function VoiceVision() {
  const [tab, setTab] = useState<Tab>('voice');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-neutral-800 pb-2 text-sm">
        {(['voice', 'vision'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 capitalize ${
              tab === t ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'voice' ? <Voice /> : <Vision />}
    </div>
  );
}

function Voice() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [text, setText] = useState('Hello from HAULT.');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    chunks.current = [];
    rec.ondataavailable = (e) => chunks.current.push(e.data);
    rec.onstop = async () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      const audioBase64 = btoa(String.fromCharCode(...buf));
      const out = await apiFetch('/media/stt', {
        method: 'POST',
        body: JSON.stringify({ audioBase64 }),
      });
      setTranscript(out.text);
      stream.getTracks().forEach((t) => t.stop());
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  };
  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  const speak = async () => {
    const res = await fetch(`${API_BASE}/media/tts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
      },
      body: JSON.stringify({ text }),
    });
    const blob = await res.blob();
    setAudioUrl(URL.createObjectURL(blob));
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded bg-neutral-950 p-3">
        <div className="mb-1 text-xs uppercase text-neutral-500">Speech → Text</div>
        <button
          onClick={recording ? stop : start}
          className={`rounded px-3 py-1 ${recording ? 'bg-rose-700' : 'bg-neutral-800'}`}
        >
          {recording ? 'Stop' : 'Record'}
        </button>
        {transcript && <div className="mt-2 whitespace-pre-wrap rounded bg-neutral-900 p-2 font-mono text-xs">{transcript}</div>}
      </div>

      <div className="rounded bg-neutral-950 p-3">
        <div className="mb-1 text-xs uppercase text-neutral-500">Text → Speech</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="w-full rounded bg-neutral-900 px-2 py-1" />
        <button onClick={speak} className="mt-2 rounded bg-neutral-800 px-3 py-1">
          Synthesize
        </button>
        {audioUrl && <audio src={audioUrl} controls className="mt-2 w-full" />}
      </div>
    </div>
  );
}

function Vision() {
  const [ocr, setOcr] = useState('');
  const [dets, setDets] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File, kind: 'ocr' | 'detect') => {
    setBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const imageBase64 = btoa(String.fromCharCode(...buf));
      if (kind === 'ocr') {
        const out = await apiFetch('/media/ocr', { method: 'POST', body: JSON.stringify({ imageBase64 }) });
        setOcr(out.text);
      } else {
        const out = await apiFetch('/media/detect', { method: 'POST', body: JSON.stringify({ imageBase64 }) });
        setDets(out);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded bg-neutral-950 p-3">
        <div className="mb-1 text-xs uppercase text-neutral-500">OCR (Tesseract)</div>
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'ocr')} />
        {busy && <div className="mt-2 text-xs text-neutral-500">Working…</div>}
        {ocr && <pre className="mt-2 whitespace-pre-wrap rounded bg-neutral-900 p-2 font-mono text-xs">{ocr}</pre>}
      </div>

      <div className="rounded bg-neutral-950 p-3">
        <div className="mb-1 text-xs uppercase text-neutral-500">Object detection (AI vision)</div>
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'detect')} />
        <ul className="mt-2 space-y-1">
          {dets.map((d, i) => (
            <li key={i} className="rounded bg-neutral-900 px-3 py-2 text-xs">
              <span className="font-medium">{d.class}</span> · {(d.conf * 100).toFixed(0)}% · box {d.box.x},{d.box.y} {d.box.w}×{d.box.h}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
