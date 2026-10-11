import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleDot, TrendingDown, TrendingUp, XOctagon } from 'lucide-react'
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

/** Prajna brand mark: rising bars (growth) + a spark (insight). `animated` turns it into the loader. */
export function Logo({ size = 36, animated = false }: { size?: number; animated?: boolean }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={`shrink-0 ${animated ? 'prajna-anim' : ''}`} role="img" aria-label="Prajna">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2a78d6" /><stop offset="1" stopColor="#4a3aa7" /></linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${id})`} />
      <rect className="pb pb1" x="9" y="28" width="7" height="10" rx="2" fill="#fff" opacity="0.75" />
      <rect className="pb pb2" x="20.5" y="21" width="7" height="17" rx="2" fill="#fff" opacity="0.88" />
      <rect className="pb pb3" x="32" y="17" width="7" height="21" rx="2" fill="#fff" />
      <path className="ps" d="M35.5 3.5 Q36.6 9 41.5 10 Q36.6 11 35.5 16.5 Q34.4 11 29.5 10 Q34.4 9 35.5 3.5 Z" fill="#ffd66b" />
    </svg>
  )
}

export function Wordmark({ size = 36, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo size={size} />
      <span className="leading-tight">
        <span className={`block font-semibold tracking-tight ${light ? 'text-white' : 'text-ink'}`} style={{ fontSize: size * 0.5 }}>Prajna</span>
        <span className={`block text-[11px] ${light ? 'text-white/75' : 'text-muted'}`}>Student Success Intelligence</span>
      </span>
    </span>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted" role="status">
      <Logo size={44} animated /> {label}
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
export function RiskBadge({ tier, label, text }: { tier: string; label?: string; text?: string }) {
  const r = RISK[tier] ?? RISK.Low
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${r.cls}`}>
      <r.Icon className="h-3 w-3" aria-hidden /> {text ?? `${label ? `${label}: ` : ''}${tier}`}
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

// ---------- Visual primitives ----------
const BAND_COLOR: Record<string, string> = { Thriving: 'var(--good)', 'On track': 'var(--s1)', Watch: 'var(--warn)', 'At risk': 'var(--critical)' }
export const bandColor = (band: string) => BAND_COLOR[band] ?? 'var(--s1)'
export const bandFor = (score: number) => (score >= 75 ? 'Thriving' : score >= 60 ? 'On track' : score >= 45 ? 'Watch' : 'At risk')

/** Donut ring for a 0-100 score, coloured by band. */
export function ScoreRing({ score, size = 44, stroke = 5, label = true }: { score: number | null; size?: number; stroke?: number; label?: boolean }) {
  const v = score ?? 0
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = bandColor(bandFor(v))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Success Score ${fmt(score, 0)} out of 100`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--grid)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${(c * v) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      {label && <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.3} fontWeight={600} fill="var(--ink)">{fmt(score, 0)}</text>}
    </svg>
  )
}

export function Avatar({ name, band, size = 32 }: { name: string; band?: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: band ? bandColor(band) : 'var(--s7)' }}>
      {initials}
    </span>
  )
}

/** Tiny trend line, decorative (value is always shown as text next to it). */
export function Sparkline({ data, width = 96, height = 28, color = 'currentColor' }: { data: number[]; width?: number; height?: number; color?: string }) {
  const vals = data.filter((d) => d !== null && d !== undefined)
  if (vals.length < 2) return null
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * (width - 4) + 2},${height - 3 - ((v - min) / span) * (height - 6)}`).join(' ')
  const last = pts.split(' ').pop()!.split(',')
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </svg>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted"><Logo size={22} animated /> Loading insights…</div>
      <Skeleton className="mb-5 h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && <div className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent-ink">{icon}</div>}
      <div className="text-sm font-semibold">{title}</div>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </div>
  )
}

// ---------- Toasts ----------
type ToastMsg = { id: number; text: string; tone: 'success' | 'error' }
let pushToast: (t: ToastMsg) => void = () => {}
export const toast = (text: string, tone: ToastMsg['tone'] = 'success') => pushToast({ id: Date.now() + Math.random(), text, tone })

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([])
  useEffect(() => {
    pushToast = (t) => {
      setItems((s) => [...s, t])
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), 3500)
    }
    return () => { pushToast = () => {} }
  }, [])
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.tone === 'success' ? 'bg-[#0f6b2f]' : 'bg-[#b42828]'}`}>
          {t.tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XOctagon className="h-4 w-4" />} {t.text}
        </div>
      ))}
    </div>
  )
}
