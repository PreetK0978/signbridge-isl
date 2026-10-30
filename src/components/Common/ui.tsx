import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, X, type LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-electric-500 to-cyan-500 text-white shadow-glow hover:brightness-110 disabled:from-navy-600 disabled:to-navy-600 disabled:shadow-none',
  secondary: 'bg-navy-700/80 text-white border border-white/10 hover:border-cyan-400/50 hover:bg-navy-600',
  ghost: 'text-slate-300 hover:text-white hover:bg-white/5',
  danger: 'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: LucideIcon;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'secondary', icon: Icon, loading, size = 'md', className = '', children, disabled, ...rest }: ButtonProps) {
  const sizes = { sm: 'px-3 py-1.5 text-xs gap-1.5', md: 'px-4 py-2 text-sm gap-2', lg: 'px-6 py-3 text-base gap-2.5' };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${VARIANTS[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Card({ children, className = '', glow = false }: { children: ReactNode; className?: string; glow?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.07] bg-gradient-to-b from-navy-800/90 to-navy-900/90 p-5 backdrop-blur ${glow ? 'shadow-glow' : 'shadow-xl shadow-black/20'} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ icon: Icon, children, action }: { icon?: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
        {Icon && <Icon className="h-4 w-4 text-cyan-400" aria-hidden />}
        {children}
      </h2>
      {action}
    </div>
  );
}

type Tone = 'cyan' | 'blue' | 'green' | 'amber' | 'red' | 'slate';
const TONES: Record<Tone, string> = {
  cyan: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',
  blue: 'bg-electric-500/15 text-electric-400 border-electric-500/30',
  green: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
  amber: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
  red: 'bg-red-500/10 text-red-300 border-red-500/30',
  slate: 'bg-white/5 text-slate-300 border-white/10',
};

export function Badge({ tone = 'slate', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusDot({ tone }: { tone: Tone }) {
  const color = { cyan: 'bg-cyan-400', blue: 'bg-electric-400', green: 'bg-emerald-400', amber: 'bg-amber-400', red: 'bg-red-400', slate: 'bg-slate-500' }[tone];
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {tone !== 'slate' && <span className={`absolute inline-flex h-full w-full animate-pulse-ring rounded-full ${color}`} />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2.5">
          <Icon className="h-5 w-5 text-cyan-300" aria-hidden />
        </div>
      </div>
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
      <div className="mb-3 rounded-2xl bg-navy-700 p-3">
        <Icon className="h-6 w-6 text-cyan-300" aria-hidden />
      </div>
      <h3 className="font-display text-base font-semibold text-white">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-slate-400">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="animate-fade-up">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-semibold text-white md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ProgressBar({ value, max = 1, tone = 'cyan', label }: { value: number; max?: number; tone?: 'cyan' | 'amber' | 'green'; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = { cyan: 'from-electric-500 to-cyan-400', amber: 'from-amber-500 to-amber-300', green: 'from-emerald-500 to-emerald-300' }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-navy-700" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg animate-fade-up rounded-2xl border border-white/10 bg-navy-900 p-6 shadow-glow" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-white/10 bg-navy-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/20';

export function Alert({ tone = 'amber', icon: Icon, title, children }: { tone?: 'amber' | 'red' | 'cyan' | 'green'; icon?: LucideIcon; title?: string; children: ReactNode }) {
  const styles = {
    amber: 'border-amber-400/30 bg-amber-400/5 text-amber-100',
    red: 'border-red-500/30 bg-red-500/5 text-red-100',
    cyan: 'border-cyan-400/30 bg-cyan-400/5 text-cyan-50',
    green: 'border-emerald-400/30 bg-emerald-400/5 text-emerald-50',
  }[tone];
  return (
    <div className={`flex gap-3 rounded-xl border p-3 text-sm ${styles}`} role={tone === 'red' ? 'alert' : 'status'}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden />}
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-cyan-300">{format ? format(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-cyan-400" aria-label={label} />
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span>
        <span className="block text-sm text-white">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 flex-none rounded-full transition-colors ${checked ? 'bg-cyan-500' : 'bg-navy-600'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}
