import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type Tab = 'tasks' | 'notes' | 'calendar' | 'kanban' | 'habits' | 'goals' | 'pomodoro' | 'contacts';

export function Productivity() {
  const [tab, setTab] = useState<Tab>('tasks');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-2 text-sm">
        {(['tasks', 'notes', 'calendar', 'kanban', 'habits', 'goals', 'pomodoro', 'contacts'] as Tab[]).map((t) => (
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
      {tab === 'tasks' && <Tasks />}
      {tab === 'notes' && <Notes />}
      {tab === 'calendar' && <Calendar />}
      {tab === 'kanban' && <Kanban />}
      {tab === 'habits' && <Habits />}
      {tab === 'goals' && <Goals />}
      {tab === 'pomodoro' && <Pomodoro />}
      {tab === 'contacts' && <Contacts />}
    </div>
  );
}

function Tasks() {
  const [list, setList] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const refresh = async () => setList(await apiFetch('/plugins/hault.tasks/tasks'));
  useEffect(() => {
    refresh();
  }, []);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task…"
          className="flex-1 rounded bg-neutral-900 px-2 py-1 text-sm"
        />
        <button
          onClick={async () => {
            if (!title) return;
            await apiFetch('/plugins/hault.tasks/tasks', { method: 'POST', body: JSON.stringify({ title }) });
            setTitle('');
            refresh();
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Add
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {list.map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded bg-neutral-900 px-3 py-2">
            <input
              type="checkbox"
              checked={t.status === 'done'}
              onChange={async () => {
                await apiFetch(`/plugins/hault.tasks/tasks/${t.id}`, {
                  method: 'POST',
                  body: JSON.stringify({ status: t.status === 'done' ? 'next' : 'done' }),
                });
                refresh();
              }}
            />
            <span className={t.status === 'done' ? 'text-neutral-500 line-through' : ''}>{t.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Notes() {
  const [list, setList] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const refresh = async () => setList(await apiFetch('/plugins/hault.notes/notes'));
  useEffect(() => {
    refresh();
  }, []);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded bg-neutral-900 px-2 py-1 text-sm" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          placeholder="Markdown. Use [[Other Note]] to link."
          className="w-full rounded bg-neutral-950 p-2 font-mono text-xs"
        />
        <button
          onClick={async () => {
            await apiFetch('/plugins/hault.notes/notes', { method: 'POST', body: JSON.stringify({ title, body }) });
            setTitle('');
            setBody('');
            refresh();
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Save
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {list.map((n) => (
          <li key={n.id} className="rounded bg-neutral-900 px-3 py-2">
            <div className="font-medium">{n.title}</div>
            <div className="text-xs text-neutral-500 line-clamp-2">{n.body}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Calendar() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', start: '', end: '' });
  const refresh = async () => setList(await apiFetch('/plugins/hault.calendar/events'));
  useEffect(() => {
    refresh();
  }, []);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded bg-neutral-900 px-2 py-1 text-sm" />
        <input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="rounded bg-neutral-900 px-2 py-1 text-sm" />
        <input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="rounded bg-neutral-900 px-2 py-1 text-sm" />
        <button
          onClick={async () => {
            await apiFetch('/plugins/hault.calendar/events', { method: 'POST', body: JSON.stringify(form) });
            refresh();
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Add
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {list.map((e) => (
          <li key={e.id} className="rounded bg-neutral-900 px-3 py-2">
            <div className="font-medium">{e.title}</div>
            <div className="text-xs text-neutral-500">
              {e.start} → {e.end}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Kanban() {
  const [boards, setBoards] = useState<any[]>([]);
  useEffect(() => {
    apiFetch('/plugins/hault.kanban/boards').then(setBoards);
  }, []);
  const b = boards[0];
  return (
    <div className="grid grid-cols-3 gap-3">
      {b?.columns.map((c: any) => (
        <div key={c.id} className="rounded bg-neutral-900 p-3">
          <div className="mb-2 text-sm font-semibold">{c.name}</div>
          <ul className="space-y-1">
            {c.cards.map((card: any) => (
              <li key={card.id} className="rounded bg-neutral-950 px-2 py-1 text-xs">
                {card.title}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Habits() {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const refresh = async () => setList(await apiFetch('/plugins/hault.habits/habits'));
  useEffect(() => {
    refresh();
  }, []);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meditate" className="flex-1 rounded bg-neutral-900 px-2 py-1 text-sm" />
        <button
          onClick={async () => {
            await apiFetch('/plugins/hault.habits/habits', { method: 'POST', body: JSON.stringify({ name }) });
            setName('');
            refresh();
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Add
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {list.map((h) => (
          <li key={h.id} className="flex items-center justify-between rounded bg-neutral-900 px-3 py-2">
            <div>
              {h.name} <span className="text-xs text-neutral-500">· streak {h.streak}</span>
            </div>
            <button
              onClick={async () => {
                await apiFetch(`/plugins/hault.habits/habits/${h.id}/check`, { method: 'POST' });
                refresh();
              }}
              className="rounded bg-neutral-800 px-2 py-1 text-xs"
            >
              Check in
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Goals() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    apiFetch('/plugins/hault.goals/goals').then(setList);
  }, []);
  return (
    <ul className="space-y-2 text-sm">
      {list.map((g) => (
        <li key={g.id} className="rounded bg-neutral-900 px-3 py-2">
          <div className="font-medium">{g.objective}</div>
          <div className="mt-1 h-2 rounded bg-neutral-800">
            <div className="h-full rounded bg-emerald-500" style={{ width: `${g.progress}%` }} />
          </div>
        </li>
      ))}
      {list.length === 0 && <div className="text-neutral-500">No goals yet.</div>}
    </ul>
  );
}

function Pomodoro() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    apiFetch('/plugins/hault.pomodoro/stats').then(setStats);
  }, []);
  return (
    <div className="space-y-2">
      <button
        onClick={() => apiFetch('/plugins/hault.pomodoro/start', { method: 'POST', body: JSON.stringify({}) })}
        className="rounded bg-neutral-800 px-3 py-1 text-sm"
      >
        Start focus session
      </button>
      {stats && (
        <div className="text-sm text-neutral-400">
          Today: {stats.todayFocusMin} min · {stats.totalSessions} sessions
        </div>
      )}
    </div>
  );
}

function Contacts() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const refresh = async () => setList(await apiFetch(`/plugins/hault.contacts/contacts?q=${encodeURIComponent(q)}`));
  useEffect(() => {
    refresh();
  }, [q]);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="flex-1 rounded bg-neutral-900 px-2 py-1 text-sm" />
        <button
          onClick={async () => {
            await apiFetch('/plugins/hault.contacts/sync/google', { method: 'POST' });
            refresh();
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Sync Google
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {list.map((c) => (
          <li key={c.id} className="rounded bg-neutral-900 px-3 py-2">
            <div className="font-medium">{c.name}</div>
            <div className="text-xs text-neutral-500">
              {(c.emails || []).join(', ')} {c.org && `· ${c.org}`}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
