import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  Puzzle,
  Settings,
  Bell,
  LogOut,
  Monitor,
  Globe,
  MessageCircle,
  Mail,
  BookOpen,
  Code2,
  CheckSquare,
  FolderOpen,
  Workflow,
  HeartPulse,
  Brain,
  Mic,
  Store,
  Shield,
} from 'lucide-react';



import clsx from 'clsx';
import { useAuth } from '../lib/auth-context';
import { Dashboard } from './Dashboard';
import { PermissionsPage } from './Permissions';
import { PluginsPage } from './Plugins';
import { SettingsPage } from './Settings';
import { ComputerControl } from './ComputerControl';
import { BrowserPage } from './BrowserPage';
import { AiChat } from './AiChat';
import { Communications } from './Communications';
import { Research } from './Research';
import { Coding } from './Coding';
import { Productivity } from './Productivity';
import { Knowledge } from './Knowledge';
import { Automations } from './Automations';
import { Life } from './Life';
import { AiEngine } from './AiEngine';
import { VoiceVision } from './VoiceVision';
import { Marketplace } from './Marketplace';
import { AdminPage } from './Admin';

type Nav = 'dashboard' | 'chat' | 'permissions' | 'plugins' | 'marketplace' | 'computer' | 'browser' | 'comms' | 'research' | 'coding' | 'productivity' | 'knowledge' | 'automations' | 'life' | 'aiengine' | 'voicevision' | 'admin' | 'settings';




const NAV: Array<{ id: Nav; label: string; icon: ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { id: 'chat', label: 'AI Chat', icon: <MessageCircle size={16} /> },
  { id: 'research', label: 'Research', icon: <BookOpen size={16} /> },
  { id: 'coding', label: 'Coding', icon: <Code2 size={16} /> },
  { id: 'productivity', label: 'Productivity', icon: <CheckSquare size={16} /> },
  { id: 'knowledge', label: 'Knowledge & Files', icon: <FolderOpen size={16} /> },
  { id: 'automations', label: 'Automations', icon: <Workflow size={16} /> },
  { id: 'life', label: 'Health & Finance', icon: <HeartPulse size={16} /> },
  { id: 'aiengine', label: 'AI Engine', icon: <Brain size={16} /> },
  { id: 'voicevision', label: 'Voice & Vision', icon: <Mic size={16} /> },



  { id: 'permissions', label: 'Permissions', icon: <ShieldCheck size={16} /> },
  { id: 'plugins', label: 'Plugins', icon: <Puzzle size={16} /> },
  { id: 'marketplace', label: 'Marketplace', icon: <Store size={16} /> },
  { id: 'computer', label: 'Computer Control', icon: <Monitor size={16} /> },
  { id: 'browser', label: 'Browser', icon: <Globe size={16} /> },
  { id: 'comms', label: 'Communications', icon: <Mail size={16} /> },
  { id: 'admin', label: 'Admin', icon: <Shield size={16} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const [nav, setNav] = useState<Nav>('dashboard');

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950/60 p-3">
        <div className="mb-6 px-2">
          <div className="text-sm font-semibold tracking-wide">HAULT</div>
          <div className="text-xs text-neutral-500">{user?.email}</div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setNav(item.id)}
              className={clsx(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                nav === item.id
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
          <h1 className="text-sm font-medium capitalize text-neutral-200">{nav}</h1>
          <button className="rounded-md p-2 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200">
            <Bell size={16} />
          </button>
        </header>
        <div className="p-6">
          {nav === 'dashboard' && <Dashboard />}
          {nav === 'chat' && <AiChat />}
          {nav === 'permissions' && <PermissionsPage />}
          {nav === 'plugins' && <PluginsPage />}
          {nav === 'marketplace' && <Marketplace />}
          {nav === 'computer' && <ComputerControl />}
          {nav === 'browser' && <BrowserPage />}
          {nav === 'comms' && <Communications />}
          {nav === 'research' && <Research />}
          {nav === 'coding' && <Coding />}
          {nav === 'productivity' && <Productivity />}
          {nav === 'knowledge' && <Knowledge />}
          {nav === 'automations' && <Automations />}
          {nav === 'life' && <Life />}
          {nav === 'aiengine' && <AiEngine />}
          {nav === 'voicevision' && <VoiceVision />}
          {nav === 'admin' && <AdminPage />}
          {nav === 'settings' && <SettingsPage />}



        </div>
      </main>
    </div>
  );
}
