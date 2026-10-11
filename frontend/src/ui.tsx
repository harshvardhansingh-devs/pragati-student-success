import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleDot, Loader2, TrendingDown, TrendingUp, XOctagon } from 'lucide-react'
import { api } from './api'

export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    if (!path) return
    setLoading(true)
    api<T>(path)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [path])
  useEffect(load, [load])
  return { data, error, loading, reload: load }
}

export const fmt = (v: number | null | undefined, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? '–' : v.toFixed(d))
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${Math.round(v * 100)}%`)

export function Card({ title, subtitle, action, children, className = '' }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 min-w-0 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  )
}

export function ErrorBox({ error }: { error: string }) {
  return <div className="card border-critical/40 p-4 text-sm text-critical-text" role="alert">{error}</div>
}

const BAND: Record<string, { cls: string; Icon: typeof CheckCircle2 }> = {
  Thriving: { cls: 'text-good-text bg-good/10', Icon: CheckCircle2 },
  'On track': { cls: 'text-accent-ink bg-accent-soft', Icon: CircleDot },
  Watch: { cls: 'text-warn-text bg-warn/15', Icon: AlertTriangle },
  'At risk': { cls: 'text-critical-text bg-critical/10', Icon: XOctagon },
}
export function BandBadge({ band }: { band: string }) {
  const b = BAND[band] ?? BAND['On track']
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>
      <b.Icon className="h-3 w-3" aria-hidden /> {band}
    </span>
  )
}

const RISK: Record<string, { cls: string; Icon: typeof CheckCircle2 }> = {
  High: { cls: 'text-critical-text bg-critical/10 ring-1 ring-critical/30', Icon: XOctagon },
  Medium: { cls: 'text-warn-text bg-warn/15', Icon: AlertTriangle },
  Low: { cls: 'text-good-text bg-good/10', Icon: CheckCircle2 },
}
export function RiskBadge({ tier, label }: { tier: string; label?: string }) {
  const r = RISK[tier] ?? RISK.Low
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${r.cls}`}>
      <r.Icon className="h-3 w-3" aria-hidden /> {label ? `${label}: ` : ''}{tier}
    </span>
  )
}

export function Trend({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-muted">–</span>
  const down = value < 0
  const Icon = down ? TrendingDown : TrendingUp
  return (
    <span className={`inline-flex items-center gap-1 tnum text-xs font-medium ${value <= -10 ? 'text-critical-text' : down ? 'text-ink-2' : 'text-good-text'}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {value > 0 ? '+' : ''}{value.toFixed(1)}
    </span>
  )
}

export function Kpi({ label, value, sub, tone = 'default', onClick, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'critical' | 'warn' | 'good'; onClick?: () => void; icon?: ReactNode }) {
  const toneCls = { default: '', critical: 'border-l-4 border-l-critical', warn: 'border-l-4 border-l-warn', good: 'border-l-4 border-l-good' }[tone]
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`card min-w-0 p-4 text-left ${toneCls} ${onClick ? 'cursor-pointer transition hover:shadow-md hover:-translate-y-px' : ''}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-2">{icon}{label}</div>
      <div className="mt-1.5 text-2xl font-semibold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </Tag>
  )
}

export function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: (string | [string, string])[]; label: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink">
        <option value="">All</option>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o]
          return <option key={v} value={v}>{l}</option>
        })}
      </select>
    </label>
  )
}

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button', className = '' }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'outline'; disabled?: boolean; type?: 'button' | 'submit'; className?: string }) {
  const v = {
    primary: 'bg-accent text-white hover:brightness-110',
    outline: 'border border-line bg-surface text-ink hover:bg-surface-2',
    ghost: 'text-accent-ink hover:bg-accent-soft',
  }[variant]
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}>
      {children}
    </button>
  )
}

export const DOMAIN_LABEL: Record<string, string> = {
  academic: 'Academic', attendance: 'Attendance', lms: 'Learning (LMS)', placement: 'Placement', skills: 'Skills', engagement: 'Engagement',
}
export const DOMAINS = Object.keys(DOMAIN_LABEL)

export function Bar({ value, max = 100, color = 'var(--accent)' }: { value: number | null; max?: number; color?: string }) {
  const w = value === null ? 0 : Math.max(2, Math.min(100, (value / max) * 100))
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-2" aria-hidden>
      <div className="h-1.5 rounded-full" style={{ width: `${w}%`, background: color }} />
    </div>
  )
}
