#!/usr/bin/env node
// Generates plugin scaffolds (manifest.json + src/index.ts + README.md) for
// every phase in the HAULT roadmap. Idempotent: skips files that already exist.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('plugins');

/** @type {Array<{id:string, phase:number, name:string, desc:string, danger?:'low'|'medium'|'high', perms:Array<[string,string,string]>, route?:string, icon?:string}>} */
const PLUGINS = [
  // Phase 2 — Computer Control (files, folders, search, clipboard, ocr, screenshot, downloads, zip, backup)
  { id: 'files',       phase: 2, name: 'Files',       desc: 'Browse, read, write, and organize local files.',                 danger: 'high',   perms: [['computer.fs.read','path:*','Read files'],['computer.fs.write','path:*','Write files']], route: '/files', icon: 'folder' },
  { id: 'folders',     phase: 2, name: 'Folders',     desc: 'Create, move, and delete folders.',                              danger: 'high',   perms: [['computer.fs.write','path:*','Modify folders']], route: '/folders', icon: 'folders' },
  { id: 'search',      phase: 2, name: 'Search',      desc: 'Full-text search across indexed files and notes.',               perms: [['computer.fs.read','path:*','Index files for search']], route: '/search', icon: 'search' },
  { id: 'clipboard',   phase: 2, name: 'Clipboard',   desc: 'Clipboard history + pinned snippets.',                           perms: [['computer.clipboard.read','*','Read clipboard'],['computer.clipboard.write','*','Write clipboard']], route: '/clipboard', icon: 'clipboard' },
  { id: 'ocr',         phase: 2, name: 'OCR',         desc: 'Extract text from images via the vision provider.',              perms: [['vision.ocr','image:*','Run OCR on an image']], route: '/ocr', icon: 'scan-text' },
  { id: 'screenshot',  phase: 2, name: 'Screenshot',  desc: 'Region + window screenshots, annotations, quick share.',         danger: 'medium', perms: [['computer.screen.capture','display:*','Capture screen']], route: '/screenshot', icon: 'camera' },
  { id: 'downloads',   phase: 2, name: 'Downloads',   desc: 'Managed download queue with resume + hash verify.',              perms: [['net.fetch','url:*','Download remote files'],['computer.fs.write','path:downloads/*','Save downloads']], route: '/downloads', icon: 'download' },
  { id: 'zip',         phase: 2, name: 'Archive',     desc: 'Create and extract zip / tar / 7z archives.',                    perms: [['computer.fs.read','path:*','Read source files'],['computer.fs.write','path:*','Write archive']], route: '/archives', icon: 'archive' },
  { id: 'backup',      phase: 2, name: 'Backup',      desc: 'Encrypted incremental backups to any storage provider.',         danger: 'medium', perms: [['storage.write','namespace:backups/*','Store backups'],['computer.fs.read','path:*','Read files to back up']], route: '/backup', icon: 'shield-check' },

  // Phase 3 — Browser Automation
  { id: 'browser',        phase: 3, name: 'Browser',        desc: 'Headless Playwright browser sessions with cookies and profiles.', danger: 'high', perms: [['browser.launch','profile:*','Launch browser'],['browser.navigate','url:*','Navigate']], route: '/browser', icon: 'globe' },
  { id: 'tabs',           phase: 3, name: 'Tabs',           desc: 'Multi-tab session management.',                                  perms: [['browser.tabs','session:*','Manage tabs']], route: '/tabs', icon: 'layout' },
  { id: 'bookmarks',      phase: 3, name: 'Bookmarks',      desc: 'Bookmarks with tags and full-text search.',                       perms: [['storage.write','namespace:bookmarks/*','Save bookmarks']], route: '/bookmarks', icon: 'bookmark' },
  { id: 'reading-mode',   phase: 3, name: 'Reading Mode',   desc: 'Reader-view extraction for any URL.',                             perms: [['net.fetch','url:*','Fetch article']], route: '/read', icon: 'book-open' },
  { id: 'research-mode',  phase: 3, name: 'Research Mode',  desc: 'Multi-source research with citations.',                           perms: [['ai.chat.completion','*','Summarize'],['net.fetch','url:*','Fetch sources']], route: '/research', icon: 'flask-conical' },
  { id: 'summaries',      phase: 3, name: 'Summaries',      desc: 'YouTube + website summarization.',                                perms: [['ai.chat.completion','*','Summarize'],['net.fetch','url:*','Fetch transcript/page']], route: '/summaries', icon: 'align-left' },
  { id: 'autofill',       phase: 3, name: 'Autofill',       desc: 'Secure per-site autofill from the credential vault.',             danger: 'high', perms: [['vault.read','entry:*','Read credentials'],['browser.input','tab:*','Fill form']], route: '/autofill', icon: 'form-input' },
  { id: 'cookie-manager', phase: 3, name: 'Cookie Manager', desc: 'Inspect, export, and clear browser cookies per site.',            danger: 'medium', perms: [['browser.cookies','domain:*','Read/write cookies']], route: '/cookies', icon: 'cookie' },
  { id: 'voice-trigger',  phase: 3, name: 'Voice Trigger',  desc: 'Wake-word activation of any command.',                            perms: [['voice.wakeword','device:*','Listen for wake word']], route: '/voice-trigger', icon: 'mic' },

  // Phase 4 — Communication
  { id: 'gmail',      phase: 4, name: 'Gmail',      desc: 'Read, compose, label Gmail via OAuth.',              danger: 'high',   perms: [['oauth.token.read','provider:google','Use Google session'],['net.fetch','host:gmail.googleapis.com','Call Gmail API']], route: '/gmail', icon: 'mail' },
  { id: 'outlook',    phase: 4, name: 'Outlook',    desc: 'Microsoft Graph mail integration.',                  danger: 'high',   perms: [['oauth.token.read','provider:microsoft','Use MS session'],['net.fetch','host:graph.microsoft.com','Call Graph']], route: '/outlook', icon: 'inbox' },
  { id: 'telegram',   phase: 4, name: 'Telegram',   desc: 'Bot API + user API (MTProto) bridge.',               perms: [['secret.read','key:telegram.*','Use bot token']], route: '/telegram', icon: 'send' },
  { id: 'whatsapp',   phase: 4, name: 'WhatsApp',   desc: 'WhatsApp Business Cloud API.',                       perms: [['secret.read','key:whatsapp.*','Use API token']], route: '/whatsapp', icon: 'message-square' },
  { id: 'discord',    phase: 4, name: 'Discord',    desc: 'Bot + webhook integration.',                          perms: [['secret.read','key:discord.*','Use bot token']], route: '/discord', icon: 'hash' },
  { id: 'sms-twilio', phase: 4, name: 'SMS',        desc: 'Twilio-compatible SMS gateway.',                      perms: [['secret.read','key:twilio.*','Use API creds'],['net.fetch','host:api.twilio.com','Send SMS']], route: '/sms', icon: 'message-circle' },
  { id: 'contacts',   phase: 4, name: 'Contacts',   desc: 'Unified contacts across providers.',                  perms: [['storage.write','namespace:contacts/*','Store contacts']], route: '/contacts', icon: 'users' },

  // Phase 5 — Research Workshop
  { id: 'academic-search', phase: 5, name: 'Academic Search', desc: 'Search arXiv, Semantic Scholar, PubMed.',   perms: [['net.fetch','host:api.semanticscholar.org','Search papers']], route: '/academic', icon: 'library' },
  { id: 'citations',       phase: 5, name: 'Citations',       desc: 'Zotero-like citation manager (BibTeX, CSL).', perms: [['storage.write','namespace:citations/*','Store references']], route: '/citations', icon: 'quote' },
  { id: 'paper-summarizer',phase: 5, name: 'Paper Summarizer',desc: 'Extract structured summaries from PDFs.',    perms: [['ai.chat.completion','*','Summarize'],['storage.read','namespace:papers/*','Read PDFs']], route: '/summarize-paper', icon: 'file-text' },
  { id: 'lit-review',      phase: 5, name: 'Literature Review',desc:'AI-assisted systematic literature reviews.', perms: [['ai.chat.completion','*','Analyze']], route: '/lit-review', icon: 'notebook-pen' },
  { id: 'knowledge-graph', phase: 5, name: 'Knowledge Graph', desc: 'Auto-linked concept graph from your notes.',  perms: [['storage.read','namespace:notes/*','Read notes']], route: '/graph', icon: 'network' },
  { id: 'notes',           phase: 5, name: 'Notes',           desc: 'Markdown notes with backlinks.',              perms: [['storage.write','namespace:notes/*','Store notes']], route: '/notes', icon: 'sticky-note' },
  { id: 'ai-qa',           phase: 5, name: 'AI Q&A',          desc: 'RAG-powered Q&A over your knowledge base.',   perms: [['ai.chat.completion','*','Answer'],['vector.query','*','Retrieve']], route: '/ask', icon: 'help-circle' },

  // Phase 6 — Coding Workshop
  { id: 'github',      phase: 6, name: 'GitHub',      desc: 'Repos, issues, PRs, actions.',                    perms: [['oauth.token.read','provider:github','GitHub session'],['net.fetch','host:api.github.com','GitHub API']], route: '/github', icon: 'github' },
  { id: 'code-editor', phase: 6, name: 'Code Editor', desc: 'Monaco-based editor with LSP bridge.',            perms: [['computer.fs.read','path:*','Read source'],['computer.fs.write','path:*','Write source']], route: '/code', icon: 'code' },
  { id: 'ai-coding',   phase: 6, name: 'AI Coding',   desc: 'Inline suggestions + repo-wide edits.',           perms: [['ai.chat.completion','*','Generate code']], route: '/ai-coding', icon: 'sparkles' },
  { id: 'code-docs',   phase: 6, name: 'Docs',        desc: 'Fetch and search language / framework docs.',     perms: [['net.fetch','url:*','Fetch docs']], route: '/docs', icon: 'book' },
  { id: 'terminal',    phase: 6, name: 'Terminal',    desc: 'Web terminal (pty) with recording.',              danger: 'high', perms: [['computer.shell.exec','cmd:*','Run shell commands']], route: '/terminal', icon: 'terminal' },
  { id: 'docker',      phase: 6, name: 'Docker',      desc: 'Manage local Docker containers and images.',      danger: 'high', perms: [['computer.shell.exec','cmd:docker','Docker CLI']], route: '/docker', icon: 'container' },
  { id: 'api-testing', phase: 6, name: 'API Testing', desc: 'Postman-style HTTP client with collections.',     perms: [['net.fetch','url:*','Send requests']], route: '/api', icon: 'zap' },
  { id: 'bug-perf',    phase: 6, name: 'Bug & Perf',  desc: 'Log tailing, flamegraph viewer, error triage.',   perms: [['computer.fs.read','path:*','Read logs']], route: '/bug', icon: 'bug' },

  // Phase 7 — Productivity
  { id: 'tasks',       phase: 7, name: 'Tasks',       desc: 'GTD-style task manager.',                          perms: [['storage.write','namespace:tasks/*','Store tasks']], route: '/tasks', icon: 'check-square' },
  { id: 'calendar',    phase: 7, name: 'Calendar',    desc: 'CalDAV + local calendar with reminders.',          perms: [['storage.write','namespace:calendar/*','Store events']], route: '/calendar', icon: 'calendar' },
  { id: 'kanban',      phase: 7, name: 'Kanban',      desc: 'Project boards.',                                  perms: [['storage.write','namespace:kanban/*','Store boards']], route: '/kanban', icon: 'columns' },
  { id: 'notes-prod',  phase: 7, name: 'Quick Notes', desc: 'Lightweight sticky notes.',                        perms: [['storage.write','namespace:quick-notes/*','Store notes']], route: '/quick-notes', icon: 'notebook' },
  { id: 'whiteboard',  phase: 7, name: 'Whiteboard',  desc: 'Excalidraw-style infinite canvas.',                perms: [['storage.write','namespace:whiteboard/*','Store canvases']], route: '/whiteboard', icon: 'pen-tool' },
  { id: 'habits',      phase: 7, name: 'Habits',      desc: 'Habit streaks + reminders.',                       perms: [['storage.write','namespace:habits/*','Store habits']], route: '/habits', icon: 'repeat' },
  { id: 'goals',       phase: 7, name: 'Goals',       desc: 'OKR-style goal tracking.',                         perms: [['storage.write','namespace:goals/*','Store goals']], route: '/goals', icon: 'target' },
  { id: 'pomodoro',    phase: 7, name: 'Pomodoro',    desc: 'Focus timer with session logs.',                   perms: [], route: '/pomodoro', icon: 'timer' },

  // Phase 9-11 — Health, Finance, Automation
  { id: 'health',      phase: 9,  name: 'Health',      desc: 'Weight, sleep, workout, nutrition logs.',        perms: [['storage.write','namespace:health/*','Store health data']], route: '/health', icon: 'heart' },
  { id: 'finance',     phase: 10, name: 'Finance',     desc: 'Transactions, budgets, net-worth tracking.',      perms: [['storage.write','namespace:finance/*','Store finance data']], route: '/finance', icon: 'wallet' },
  { id: 'automations', phase: 11, name: 'Automations', desc: 'IFTTT-style trigger → action pipelines.',        perms: [['plugin.invoke','*','Invoke other plugins']], route: '/automations', icon: 'workflow' },

  // Phase 15 — Admin
  { id: 'admin',       phase: 15, name: 'Admin',       desc: 'Logs, analytics, errors, API usage, sessions.',   danger: 'medium', perms: [['admin.*','*','Full admin surface']], route: '/admin', icon: 'shield' },
];

const template = (p) => ({
  manifest: {
    id: `hault.${p.id}`, name: p.name, version: '0.1.0', description: p.desc,
    author: 'HAULT Core', entry: 'dist/index.js',
    ...(p.danger ? { danger: p.danger } : {}),
    permissions: p.perms.map(([action, scope, reason]) => ({ action, scope, reason })),
    ui: p.route ? { routes: [{ path: p.route, title: p.name, icon: p.icon || 'square' }] } : undefined,
  },
  src: `import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * ${p.name} — ${p.desc}
 * Phase ${p.phase} of the HAULT roadmap.
 *
 * This scaffold registers HTTP + WS surfaces and a health check.
 * Concrete implementation lives in the ticket that lands this plugin.
 */
export default definePlugin({
  id: 'hault.${p.id}',
  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.${p.id}' }));
${p.perms.map(([a, s, r]) => `    // Permission gate: ${a} ${s} — ${r}`).join('\n')}
    ctx.log.info('${p.name} plugin activated');
  },
  async deactivate() {},
});
`,
  readme: `# ${p.name}\n\n${p.desc}\n\n**Phase:** ${p.phase}\n**Danger:** ${p.danger || 'low'}\n\n## Permissions\n\n${p.perms.map(([a, s, r]) => `- \`${a}\` (\`${s}\`) — ${r}`).join('\n') || '_(none)_'}\n`,
});

let created = 0, skipped = 0;
for (const p of PLUGINS) {
  const dir = path.join(ROOT, p.id);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  const t = template(p);
  const writes = [
    ['manifest.json', JSON.stringify(t.manifest, null, 2) + '\n'],
    ['src/index.ts', t.src],
    ['README.md', t.readme],
  ];
  for (const [rel, content] of writes) {
    const abs = path.join(dir, rel);
    if (fs.existsSync(abs)) { skipped++; continue; }
    fs.writeFileSync(abs, content);
    created++;
  }
}
console.log(`[gen-plugins] created ${created}, skipped ${skipped}`);
