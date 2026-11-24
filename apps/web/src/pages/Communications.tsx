import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface Message {
  id: string;
  from?: string;
  subject?: string;
  snippet?: string;
  date?: string;
  unread: boolean;
}

type Channel = 'gmail' | 'slack' | 'discord' | 'telegram';

export function Communications() {
  const [tab, setTab] = useState<Channel>('gmail');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-neutral-800">
        {(['gmail', 'slack', 'discord', 'telegram'] as Channel[]).map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={`px-3 py-2 text-sm capitalize ${
              tab === c
                ? 'border-b-2 border-neutral-100 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {tab === 'gmail' && <GmailPane />}
      {tab === 'slack' && <SendPane channel="slack" endpoint="/plugins/hault.slack/message" fields={['channel', 'text']} />}
      {tab === 'discord' && <SendPane channel="discord" endpoint="/plugins/hault.discord/channel" fields={['channelId', 'content']} />}
      {tab === 'telegram' && <SendPane channel="telegram" endpoint="/plugins/hault.telegram/send" fields={['chatId', 'text']} />}
    </div>
  );
}

function GmailPane() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function loadInbox() {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch('/plugins/hault.gmail/inbox?max=20');
      setMessages(r.messages || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadInbox(); }, []);

  async function send() {
    setSending(true);
    setError(null);
    try {
      await apiFetch('/plugins/hault.gmail/send', {
        method: 'POST',
        body: JSON.stringify({ to, subject, body }),
      });
      setTo(''); setSubject(''); setBody('');
      await loadInbox();
    } catch (e: any) {
      setError(e.message || 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-md border border-neutral-800 bg-neutral-950/40">
        <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
          <h2 className="text-sm font-medium">Inbox</h2>
          <button onClick={loadInbox} className="text-xs text-neutral-400 hover:text-neutral-200">
            Refresh
          </button>
        </div>
        <div className="max-h-[520px] divide-y divide-neutral-800 overflow-auto">
          {loading && <div className="p-3 text-xs text-neutral-500">Loading…</div>}
          {!loading && messages.length === 0 && (
            <div className="p-3 text-xs text-neutral-500">No messages. Connect Google in Settings first.</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className="px-3 py-2">
              <div className="flex items-center gap-2">
                {m.unread && <span className="h-2 w-2 rounded-full bg-blue-400" />}
                <div className="truncate text-sm text-neutral-200">{m.subject || '(no subject)'}</div>
              </div>
              <div className="truncate text-xs text-neutral-500">{m.from}</div>
              <div className="truncate text-xs text-neutral-600">{m.snippet}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <h2 className="mb-2 text-sm font-medium">Compose</h2>
        <div className="space-y-2">
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="to@example.com"
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm"
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Message body…"
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm"
          />
          <button
            onClick={send}
            disabled={sending || !to || !subject}
            className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm text-neutral-900 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      </section>
    </div>
  );
}

function SendPane({
  channel,
  endpoint,
  fields,
}: {
  channel: string;
  endpoint: string;
  fields: [string, string];
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ [fields[0]]: a, [fields[1]]: b }),
      });
      setMsg('Sent ✓');
      setB('');
    } catch (e: any) {
      setMsg(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-xl rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
      <h2 className="mb-2 text-sm font-medium capitalize">Send via {channel}</h2>
      <div className="space-y-2">
        <input
          value={a}
          onChange={(e) => setA(e.target.value)}
          placeholder={fields[0]}
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm"
        />
        <textarea
          value={b}
          onChange={(e) => setB(e.target.value)}
          rows={6}
          placeholder={fields[1]}
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm"
        />
        <button
          onClick={send}
          disabled={busy || !a || !b}
          className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm text-neutral-900 disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
        {msg && <div className="text-xs text-neutral-400">{msg}</div>}
        <p className="text-xs text-neutral-600">
          Configure the bot token / webhook URL in Settings → Secrets before sending.
        </p>
      </div>
    </section>
  );
}
