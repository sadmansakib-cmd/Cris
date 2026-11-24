import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Browser plugin — headless Playwright sessions with per-user profiles,
 * cookies, and screenshot capture. Each verb is permission-gated.
 *
 * Sessions live in memory keyed by sessionId. They are torn down on
 * `browser.close`, plugin deactivate, or an idle timeout enforced by
 * the sandbox supervisor.
 */
type PwBrowser = { newContext: (o?: any) => Promise<any>; close: () => Promise<void> };
type Session = { browser: PwBrowser; context: any; page: any; profile: string };

const sessions = new Map<string, Session>();

export default definePlugin({
  id: 'hault.browser',
  async activate(ctx: PluginContext) {
    // Lazy-loaded so the worker doesn't pay the import cost until first use.
    const loadPw = async () => (await import('playwright')).chromium;

    ctx.http.post('/launch', async (req) => {
      const profile = (req.body?.profile as string | undefined) ?? 'default';
      await ctx.permissions.require('browser.launch', `profile:${profile}`, `Launch browser profile "${profile}"`);
      const chromium = await loadPw();
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, { browser, context, page, profile });
      return { sessionId, profile };
    });

    ctx.http.post('/navigate', async (req) => {
      const { sessionId, url } = req.body as { sessionId: string; url: string };
      await ctx.permissions.require('browser.navigate', `url:${new URL(url).host}`, `Navigate to ${url}`);
      const s = requireSession(sessionId);
      await s.page.goto(url, { waitUntil: 'domcontentloaded' });
      return { url: s.page.url(), title: await s.page.title() };
    });

    ctx.http.post('/screenshot', async (req) => {
      const { sessionId } = req.body as { sessionId: string };
      await ctx.permissions.require('browser.screenshot', `session:${sessionId}`, 'Capture browser screenshot');
      const s = requireSession(sessionId);
      const buf = (await s.page.screenshot({ fullPage: false })) as Buffer;
      const key = `browser/${req.userId}/shot-${Date.now()}.png`;
      await ctx.storage.put(key, buf, 'image/png');
      return { key, size: buf.length };
    });

    ctx.http.post('/extract', async (req) => {
      const { sessionId, selector } = req.body as { sessionId: string; selector?: string };
      await ctx.permissions.require('browser.extract', `session:${sessionId}`, 'Extract page content');
      const s = requireSession(sessionId);
      if (selector) {
        return { text: await s.page.locator(selector).allInnerTexts() };
      }
      return { title: await s.page.title(), text: await s.page.innerText('body') };
    });

    ctx.http.post('/click', async (req) => {
      const { sessionId, selector } = req.body as { sessionId: string; selector: string };
      await ctx.permissions.require('browser.click', `session:${sessionId}`, `Click ${selector}`);
      const s = requireSession(sessionId);
      await s.page.locator(selector).first().click();
      return { ok: true };
    });

    ctx.http.post('/fill', async (req) => {
      const { sessionId, selector, value } = req.body as { sessionId: string; selector: string; value: string };
      await ctx.permissions.require('browser.fill', `session:${sessionId}`, `Fill ${selector}`);
      const s = requireSession(sessionId);
      await s.page.locator(selector).first().fill(value);
      return { ok: true };
    });

    ctx.http.post('/close', async (req) => {
      const { sessionId } = req.body as { sessionId: string };
      const s = sessions.get(sessionId);
      if (!s) return { ok: true, closed: false };
      await s.browser.close().catch(() => {});
      sessions.delete(sessionId);
      return { ok: true, closed: true };
    });

    ctx.http.get('/sessions', async () => ({
      sessions: [...sessions.entries()].map(([id, s]) => ({ id, profile: s.profile })),
    }));

    ctx.log.info('Browser plugin activated');
  },
  async deactivate() {
    for (const [, s] of sessions) await s.browser.close().catch(() => {});
    sessions.clear();
  },
});

function requireSession(id: string): Session {
  const s = sessions.get(id);
  if (!s) throw new Error(`browser session not found: ${id}`);
  return s;
}
