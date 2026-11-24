import { useState } from 'react';
import { apiFetch } from '../lib/api';

/**
 * Phase 2 UI — send high-level intents to the `computer-control` plugin.
 * Each action is gated by the permission engine on the host side.
 */
export function ComputerControl() {
  const [shellCmd, setShellCmd] = useState('echo "hello from HAULT"');
  const [fsPath, setFsPath] = useState('/tmp/hault-note.txt');
  const [fsBody, setFsBody] = useState('written by plugin');
  const [output, setOutput] = useState<string>('');

  const invoke = async (method: string, args: unknown) => {
    setOutput('…running');
    try {
      const res = await apiFetch('/plugins/computer-control/invoke', {
        method: 'POST',
        body: JSON.stringify({ method, args }),
      });
      setOutput(JSON.stringify(res, null, 2));
    } catch (e: any) {
      setOutput(`error: ${e.message ?? e}`);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Computer Control</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Actions run inside the sandboxed <code>computer-control</code> plugin.
        Every call triggers a permission prompt unless already granted.
      </p>

      <section className="rounded-lg border p-4 mb-4">
        <h2 className="font-medium mb-2">Shell</h2>
        <input
          className="w-full border rounded px-2 py-1 mb-2 font-mono text-sm"
          value={shellCmd}
          onChange={(e) => setShellCmd(e.target.value)}
        />
        <button
          className="px-3 py-1 rounded bg-primary text-primary-foreground text-sm"
          onClick={() => invoke('shell.exec', { cmd: shellCmd })}
        >Run</button>
      </section>

      <section className="rounded-lg border p-4 mb-4">
        <h2 className="font-medium mb-2">Filesystem</h2>
        <input
          className="w-full border rounded px-2 py-1 mb-2 font-mono text-sm"
          value={fsPath}
          onChange={(e) => setFsPath(e.target.value)}
        />
        <textarea
          className="w-full border rounded px-2 py-1 mb-2 font-mono text-sm h-24"
          value={fsBody}
          onChange={(e) => setFsBody(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded border text-sm"
            onClick={() => invoke('fs.read', { path: fsPath })}
          >Read</button>
          <button
            className="px-3 py-1 rounded bg-primary text-primary-foreground text-sm"
            onClick={() => invoke('fs.write', { path: fsPath, body: fsBody })}
          >Write</button>
        </div>
      </section>

      <section className="rounded-lg border p-4 mb-4">
        <h2 className="font-medium mb-2">Input & Screen</h2>
        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-1 rounded border text-sm" onClick={() => invoke('screen.capture', {})}>Screenshot</button>
          <button className="px-3 py-1 rounded border text-sm" onClick={() => invoke('mouse.move', { x: 100, y: 100 })}>Move mouse</button>
          <button className="px-3 py-1 rounded border text-sm" onClick={() => invoke('keyboard.type', { text: 'hault' })}>Type "hault"</button>
        </div>
      </section>

      <pre className="rounded-lg border bg-muted/30 p-3 text-xs overflow-auto whitespace-pre-wrap min-h-24">
        {output || '(no output yet)'}
      </pre>
    </div>
  );
}
