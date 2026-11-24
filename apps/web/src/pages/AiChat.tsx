import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';

type Thread = { id: string; title: string; model: string | null; updatedAt: string };
type Message = { id: string; role: 'user' | 'assistant' | 'system' | 'tool'; content: string };

/**
 * AI Chat — talks to /ai/threads on the API. Non-streaming for the first
 * cut; the server returns the full assistant message once the tool loop
 * settles. Streaming lands with the WS surface in the next slice.
 */
export function AiChat() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const reloadThreads = async () => {
    const list = await apiFetch<Thread[]>('/ai/threads');
    setThreads(list);
    if (!active && list[0]) openThread(list[0].id);
  };

  const openThread = async (id: string) => {
    setActive(id);
    const t = await apiFetch<{ messages: Message[] }>(`/ai/threads/${id}`);
    setMessages(t.messages);
  };

  const createThread = async () => {
    const t = await apiFetch<Thread>('/ai/threads', { method: 'POST', body: JSON.stringify({}) });
    setThreads((prev) => [t, ...prev]);
    openThread(t.id);
  };

  const send = async () => {
    if (!active || !draft.trim() || sending) return;
    const content = draft;
    setDraft('');
    setSending(true);
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: 'user', content }]);
    try {
      const reply = await apiFetch<Message>(`/ai/threads/${active}/send`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setMessages((m) => [...m, reply]);
    } catch (e: any) {
      setMessages((m) => [...m, { id: `err-${Date.now()}`, role: 'assistant', content: `⚠ ${e.message ?? e}` }]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => { reloadThreads().catch(() => {}); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages]);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-56 shrink-0 border-r border-neutral-800 p-3">
        <button
          onClick={createThread}
          className="mb-3 w-full rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900"
        >
          New chat
        </button>
        <div className="space-y-1">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => openThread(t.id)}
              className={`block w-full truncate rounded px-2 py-1.5 text-left text-sm ${
                active === t.id ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-900'
              }`}
            >
              {t.title}
            </button>
          ))}
          {threads.length === 0 && <div className="px-2 text-xs text-neutral-500">No threads yet.</div>}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-auto p-6">
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user' ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-900 text-neutral-100'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {!active && <div className="text-sm text-neutral-500">Create a chat to get started.</div>}
        </div>
        <div className="border-t border-neutral-800 p-3">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder={active ? 'Ask HAULT anything…' : 'Select or create a chat'}
              disabled={!active || sending}
              className="flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
            />
            <button
              onClick={send}
              disabled={!active || !draft.trim() || sending}
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40"
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
