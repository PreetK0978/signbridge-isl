import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, BrainCircuit, Info, LayoutDashboard, Menu, MessageSquareText, ScanLine, Settings, X } from 'lucide-react';
import { Logo } from './Logo';
import { useAppData } from '../../hooks/useAppContext';
import { StatusDot } from './ui';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/translate', label: 'Live Translator', icon: ScanLine },
  { to: '/training', label: 'Training Studio', icon: BrainCircuit },
  { to: '/library', label: 'Sign Library', icon: BookOpen },
  { to: '/sentence', label: 'Sentence Builder', icon: MessageSquareText },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/about', label: 'About', icon: Info },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const { modelStatus, modelMeta, modelStale } = useAppData();
  const location = useLocation();
  const tone = modelStatus === 'ready' ? (modelStale ? 'amber' : 'green') : modelStatus === 'error' ? 'red' : 'slate';
  const statusText =
    modelStatus === 'ready'
      ? `${modelMeta?.labelIds.length ?? 0} signs${modelStale ? ' · outdated' : ''}`
      : modelStatus === 'loading'
        ? 'Loading model…'
        : modelStatus === 'error'
          ? 'Model error'
          : 'No model trained';

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
              isActive
                ? 'bg-gradient-to-r from-electric-500/20 to-cyan-400/5 text-white shadow-glow-sm ring-1 ring-cyan-400/30'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-navy-950 bg-grid text-slate-200">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/5 bg-navy-950/80 p-5 backdrop-blur lg:flex">
        <NavLink to="/" className="mb-8 block" aria-label="SignBridge home">
          <Logo />
        </NavLink>
        {nav}
        <div className="mt-auto rounded-xl border border-white/5 bg-navy-900/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">ISL classifier</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-white">
            <StatusDot tone={tone} /> {statusText}
          </p>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">Research prototype · on-device inference · no data leaves your browser</p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-navy-950/90 px-4 py-3 backdrop-blur lg:hidden">
        <NavLink to="/" aria-label="SignBridge home">
          <Logo size={30} />
        </NavLink>
        <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 text-slate-300 hover:bg-white/5" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {open && <div className="border-b border-white/5 bg-navy-950 px-4 py-3 lg:hidden">{nav}</div>}

      <main key={location.pathname} className="px-4 py-6 md:px-8 lg:ml-64 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
