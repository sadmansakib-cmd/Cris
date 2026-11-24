import { definePlugin, type PluginContext } from '@hault/sdk';

type Txn = {
  id: string;
  account: string;
  amount: number; // positive = income, negative = expense
  currency: string;
  category?: string;
  note?: string;
  at: string;
};
type Budget = { id: string; category: string; monthlyLimit: number; currency: string };
type Account = { id: string; name: string; type: 'cash' | 'bank' | 'card' | 'invest'; balance: number; currency: string };

export default definePlugin({
  id: 'hault.finance',
  async activate(ctx: PluginContext) {
    const loadT = async (): Promise<Txn[]> => ((await ctx.kv.get('txns')) as Txn[]) || [];
    const loadB = async (): Promise<Budget[]> => ((await ctx.kv.get('budgets')) as Budget[]) || [];
    const loadA = async (): Promise<Account[]> => ((await ctx.kv.get('accounts')) as Account[]) || [];

    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.finance' }));

    // Accounts
    ctx.http.get('/accounts', async () => loadA());
    ctx.http.post('/accounts', async (req) => {
      const { name, type, balance, currency } = (req.body || {}) as Partial<Account>;
      if (!name || !type) throw new Error('name and type required');
      const list = await loadA();
      const a: Account = {
        id: crypto.randomUUID(),
        name,
        type,
        balance: balance ?? 0,
        currency: currency ?? 'USD',
      };
      list.push(a);
      await ctx.kv.set('accounts', list);
      return a;
    });

    // Transactions
    ctx.http.get('/transactions', async (req) => {
      const list = await loadT();
      const cat = req.query?.category as string | undefined;
      return cat ? list.filter((t) => t.category === cat) : list;
    });
    ctx.http.post('/transactions', async (req) => {
      const { account, amount, currency, category, note } = (req.body || {}) as Partial<Txn>;
      if (!account || typeof amount !== 'number') throw new Error('account and amount required');
      const list = await loadT();
      const t: Txn = {
        id: crypto.randomUUID(),
        account,
        amount,
        currency: currency ?? 'USD',
        category,
        note,
        at: new Date().toISOString(),
      };
      list.unshift(t);
      await ctx.kv.set('txns', list.slice(0, 10000));

      // Roll into account balance
      const accts = await loadA();
      const a = accts.find((x) => x.id === account);
      if (a) {
        a.balance = +(a.balance + amount).toFixed(2);
        await ctx.kv.set('accounts', accts);
      }
      return t;
    });
    ctx.http.post('/transactions/delete/:id', async (req) => {
      const list = (await loadT()).filter((t) => t.id !== req.params.id);
      await ctx.kv.set('txns', list);
      return { ok: true };
    });

    // Budgets
    ctx.http.get('/budgets', async () => loadB());
    ctx.http.post('/budgets', async (req) => {
      const { category, monthlyLimit, currency } = (req.body || {}) as Partial<Budget>;
      if (!category || typeof monthlyLimit !== 'number') throw new Error('category and monthlyLimit required');
      const list = await loadB();
      const b: Budget = {
        id: crypto.randomUUID(),
        category,
        monthlyLimit,
        currency: currency ?? 'USD',
      };
      list.push(b);
      await ctx.kv.set('budgets', list);
      return b;
    });

    // Reports
    ctx.http.get('/report', async () => {
      const [txns, budgets, accts] = await Promise.all([loadT(), loadB(), loadA()]);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const mtd = txns.filter((t) => new Date(t.at).getTime() >= monthStart);
      const byCat: Record<string, number> = {};
      let income = 0;
      let expense = 0;
      for (const t of mtd) {
        if (t.amount >= 0) income += t.amount;
        else expense += -t.amount;
        if (t.category) byCat[t.category] = (byCat[t.category] || 0) + (t.amount < 0 ? -t.amount : 0);
      }
      const netWorth = accts.reduce((s, a) => s + a.balance, 0);
      const budgetStatus = budgets.map((b) => ({
        category: b.category,
        spent: +(byCat[b.category] || 0).toFixed(2),
        limit: b.monthlyLimit,
        pct: b.monthlyLimit ? +(((byCat[b.category] || 0) / b.monthlyLimit) * 100).toFixed(1) : 0,
      }));
      return {
        netWorth: +netWorth.toFixed(2),
        month: { income: +income.toFixed(2), expense: +expense.toFixed(2), net: +(income - expense).toFixed(2) },
        byCategory: byCat,
        budgetStatus,
      };
    });

    ctx.log.info('Finance plugin activated');
  },
  async deactivate() {},
});
