import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type Tab = 'health' | 'finance';

export function Life() {
  const [tab, setTab] = useState<Tab>('health');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-neutral-800 pb-2 text-sm">
        {(['health', 'finance'] as Tab[]).map((t) => (
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
      {tab === 'health' ? <HealthTab /> : <FinanceTab />}
    </div>
  );
}

function HealthTab() {
  const [list, setList] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [kind, setKind] = useState('weight');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('kg');

  const refresh = async () => {
    setList(await apiFetch('/plugins/hault.health/entries'));
    setSummary(await apiFetch('/plugins/hault.health/summary'));
  };
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <input value={kind} onChange={(e) => setKind(e.target.value)} placeholder="kind" className="rounded bg-neutral-900 px-2 py-1 text-sm" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" type="number" className="rounded bg-neutral-900 px-2 py-1 text-sm" />
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit" className="rounded bg-neutral-900 px-2 py-1 text-sm" />
        <button
          onClick={async () => {
            await apiFetch('/plugins/hault.health/entries', {
              method: 'POST',
              body: JSON.stringify({ kind, value: parseFloat(value), unit }),
            });
            setValue('');
            refresh();
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
        >
          Log
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        {Object.entries(summary).map(([k, v]: any) => (
          <div key={k} className="rounded bg-neutral-900 p-3">
            <div className="text-xs uppercase text-neutral-500">{k}</div>
            <div className="text-lg">{v.last?.value} <span className="text-xs text-neutral-500">{v.last?.unit}</span></div>
            <div className="text-xs text-neutral-500">7-day avg {v.avg7d.toFixed(1)} · {v.count} logs</div>
          </div>
        ))}
      </div>

      <ul className="divide-y divide-neutral-900 rounded bg-neutral-950 text-sm">
        {list.slice(0, 20).map((e) => (
          <li key={e.id} className="flex items-center justify-between px-3 py-2">
            <span>
              <span className="font-medium">{e.kind}</span> {e.value} {e.unit}
            </span>
            <span className="text-xs text-neutral-500">{new Date(e.at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FinanceTab() {
  const [accts, setAccts] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [tForm, setTForm] = useState({ account: '', amount: '', category: '', note: '' });

  const refresh = async () => {
    const [a, t, r, b] = await Promise.all([
      apiFetch('/plugins/hault.finance/accounts'),
      apiFetch('/plugins/hault.finance/transactions'),
      apiFetch('/plugins/hault.finance/report'),
      apiFetch('/plugins/hault.finance/budgets'),
    ]);
    setAccts(a);
    setTxns(t);
    setReport(r);
    setBudgets(b);
  };
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-3">
      {report && (
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded bg-neutral-900 p-3">
            <div className="text-xs uppercase text-neutral-500">Net worth</div>
            <div className="text-xl">${report.netWorth}</div>
          </div>
          <div className="rounded bg-neutral-900 p-3">
            <div className="text-xs uppercase text-neutral-500">MTD income</div>
            <div className="text-xl text-emerald-400">${report.month.income}</div>
          </div>
          <div className="rounded bg-neutral-900 p-3">
            <div className="text-xs uppercase text-neutral-500">MTD expense</div>
            <div className="text-xl text-rose-400">${report.month.expense}</div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-xs uppercase text-neutral-500">Accounts</div>
        <div className="flex flex-wrap gap-2">
          {accts.map((a) => (
            <div key={a.id} className="rounded bg-neutral-900 px-3 py-1 text-sm">
              {a.name} · <span className="text-neutral-400">${a.balance}</span>
            </div>
          ))}
          <button
            onClick={async () => {
              const name = prompt('Account name');
              if (!name) return;
              await apiFetch('/plugins/hault.finance/accounts', {
                method: 'POST',
                body: JSON.stringify({ name, type: 'bank', balance: 0, currency: 'USD' }),
              });
              refresh();
            }}
            className="rounded bg-neutral-800 px-2 py-1 text-xs"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 text-sm">
        <select
          value={tForm.account}
          onChange={(e) => setTForm({ ...tForm, account: e.target.value })}
          className="rounded bg-neutral-900 px-2 py-1"
        >
          <option value="">account</option>
          {accts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          value={tForm.amount}
          onChange={(e) => setTForm({ ...tForm, amount: e.target.value })}
          placeholder="amount (- expense)"
          className="rounded bg-neutral-900 px-2 py-1"
        />
        <input
          value={tForm.category}
          onChange={(e) => setTForm({ ...tForm, category: e.target.value })}
          placeholder="category"
          className="rounded bg-neutral-900 px-2 py-1"
        />
        <input
          value={tForm.note}
          onChange={(e) => setTForm({ ...tForm, note: e.target.value })}
          placeholder="note"
          className="rounded bg-neutral-900 px-2 py-1"
        />
        <button
          onClick={async () => {
            if (!tForm.account || !tForm.amount) return;
            await apiFetch('/plugins/hault.finance/transactions', {
              method: 'POST',
              body: JSON.stringify({ ...tForm, amount: parseFloat(tForm.amount) }),
            });
            setTForm({ account: tForm.account, amount: '', category: '', note: '' });
            refresh();
          }}
          className="rounded bg-neutral-800 px-3 py-1"
        >
          Record
        </button>
      </div>

      {report?.budgetStatus?.length > 0 && (
        <div>
          <div className="mb-1 text-xs uppercase text-neutral-500">Budgets</div>
          <ul className="space-y-1 text-sm">
            {report.budgetStatus.map((b: any) => (
              <li key={b.category} className="rounded bg-neutral-900 px-3 py-2">
                <div className="flex justify-between">
                  <span>{b.category}</span>
                  <span className="text-xs text-neutral-500">
                    ${b.spent} / ${b.limit} ({b.pct}%)
                  </span>
                </div>
                <div className="mt-1 h-1 rounded bg-neutral-800">
                  <div
                    className={`h-1 rounded ${b.pct > 100 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, b.pct)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={async () => {
          const category = prompt('Budget category');
          const limit = prompt('Monthly limit');
          if (!category || !limit) return;
          await apiFetch('/plugins/hault.finance/budgets', {
            method: 'POST',
            body: JSON.stringify({ category, monthlyLimit: parseFloat(limit), currency: 'USD' }),
          });
          refresh();
        }}
        className="rounded bg-neutral-800 px-3 py-1 text-xs"
      >
        + Budget
      </button>

      <ul className="divide-y divide-neutral-900 rounded bg-neutral-950 text-sm">
        {txns.slice(0, 20).map((t) => (
          <li key={t.id} className="flex items-center justify-between px-3 py-2">
            <span>
              <span className={t.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {t.amount < 0 ? '-' : '+'}${Math.abs(t.amount)}
              </span>{' '}
              <span className="text-neutral-500">{t.category}</span> {t.note}
            </span>
            <span className="text-xs text-neutral-500">{new Date(t.at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
