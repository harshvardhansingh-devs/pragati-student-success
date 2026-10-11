import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Bot, Boxes, Database, GraduationCap, LayoutDashboard, ListChecks, LogOut, Menu, Moon, Scale, Search, ShieldAlert, Sun, Users, X } from 'lucide-react'
import { api, getSession, setSession, type Session } from './api'
import { Avatar, BandBadge, Toaster, fmt, useApi } from './ui'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Students from './pages/Students'
import Student360 from './pages/Student360'
import Segments from './pages/Segments'
import Interventions from './pages/Interventions'
import DataHub from './pages/DataHub'
import Methodology from './pages/Methodology'
import Copilot from './pages/Copilot'

const AuthCtx = createContext<{ session: Session | null; login: (s: Session) => void; logout: () => void }>(null!)
export const useAuth = () => useContext(AuthCtx)

type NavItem = { to: string; label: string; icon: typeof Users; end?: boolean; badge?: 'risk' | 'open' }
const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Monitor', items: [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/at-risk', label: 'At-Risk Students', icon: ShieldAlert, badge: 'risk' },
    { to: '/students', label: 'All Students', icon: Users },
  ] },
  { group: 'Act', items: [
    { to: '/interventions', label: 'Interventions', icon: ListChecks, badge: 'open' },
    { to: '/segments', label: 'Segments', icon: Boxes },
  ] },
  { group: 'Understand', items: [
    { to: '/copilot', label: 'AI Copilot', icon: Bot },
    { to: '/data', label: 'Data Integration', icon: Database },
    { to: '/methodology', label: 'Score Methodology', icon: Scale },
  ] },
]
const TITLES: Record<string, string> = { '/': 'Overview', '/at-risk': 'At-Risk Students', '/students': 'All Students', '/interventions': 'Interventions',
  '/segments': 'Segments', '/copilot': 'AI Copilot', '/data': 'Data Integration', '/methodology': 'Score Methodology' }

function ThemeToggle() {
  const [theme, setTheme] = useState<string | null>(() => {
    try { return localStorage.getItem('pragati.theme') } catch { return null }
  })
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme
    try { if (theme) localStorage.setItem('pragati.theme', theme) } catch { /* ignore */ }
  }, [theme])
  const dark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  return (
    <button onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} title="Toggle theme"
      className="rounded-lg p-2 text-ink-2 hover:bg-surface-2">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

/** Global student search: type a name or ID, jump to the Student 360. Press "/" to focus. */
function GlobalSearch() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  const nav = useNavigate()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); ref.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (q.trim().length < 2) { setItems([]); return }
    const t = setTimeout(() => api(`/students?q=${encodeURIComponent(q.trim())}&size=6&sort=-success_score`).then((r) => { setItems(r.items); setActive(0) }).catch(() => setItems([])), 200)
    return () => clearTimeout(t)
  }, [q])
  const go = (id: string) => { setQ(''); setItems([]); setOpen(false); ref.current?.blur(); nav(`/students/${id}`) }
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
      <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && items[active]) go(items[active].student_id)
          if (e.key === 'Escape') ref.current?.blur()
        }}
        placeholder="Search students by name or ID…" aria-label="Search students" role="combobox" aria-expanded={open && items.length > 0}
        className="h-9 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-10 text-sm text-ink placeholder:text-muted focus:bg-surface" />
      <kbd className="pointer-events-none absolute right-2.5 top-2 rounded border border-line px-1.5 text-[11px] text-muted">/</kbd>
      {open && items.length > 0 && (
        <ul className="card absolute left-0 right-0 top-11 z-40 overflow-hidden p-1 shadow-xl" role="listbox">
          {items.map((s, i) => (
            <li key={s.student_id} role="option" aria-selected={i === active}>
              <button onMouseDown={() => go(s.student_id)} onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${i === active ? 'bg-accent-soft' : ''}`}>
                <Avatar name={s.name} band={s.band} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted">{s.student_id} · {s.dept} Year {s.year}</div>
                </div>
                <span className="tnum text-sm font-semibold">{fmt(s.success_score, 0)}</span>
                <BandBadge band={s.band} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Layout({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const { data: ov } = useApi('/overview')
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])
  const u = session!.user
  const scope = u.scope.dept ? `${u.scope.dept} department` : u.scope.mentor_id ? 'My mentees' : 'All departments'
  const badges = { risk: ov?.kpis.academic_high, open: ov?.kpis.open_interventions }
  const title = loc.pathname.startsWith('/students/') ? 'Student 360' : TITLES[loc.pathname] ?? ''

  const nav = (
    <nav className="flex h-full flex-col bg-nav text-nav-ink" aria-label="Main">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#2a78d6] to-[#4a3aa7] text-white shadow-lg"><GraduationCap className="h-5 w-5" /></div>
        <div>
          <div className="text-base font-semibold tracking-tight text-white">Pragati</div>
          <div className="text-[11px] leading-tight opacity-80">Student Success Intelligence</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        {NAV.map((g) => (
          <div key={g.group} className="mb-4">
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest opacity-60">{g.group}</div>
            <ul className="space-y-0.5">
              {g.items.map((n) => {
                const count = n.badge ? badges[n.badge] : undefined
                return (
                  <li key={n.to}>
                    <NavLink to={n.to} end={n.end}
                      className={({ isActive }) => `relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-white/12 font-medium text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-[#86b6ef]' : 'hover:bg-white/6 hover:text-white'}`}>
                      <n.icon className="h-4 w-4" aria-hidden /> <span className="flex-1">{n.label}</span>
                      {!!count && <span className={`rounded-full px-1.5 text-[11px] font-semibold tnum ${n.badge === 'risk' ? 'bg-[#d03b3b] text-white' : 'bg-white/15 text-white'}`}>{count}</span>}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="m-3 rounded-xl bg-white/6 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={u.name} size={32} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{u.name}</div>
            <div className="truncate text-[11px] opacity-80">{u.title}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate rounded bg-white/10 px-1.5 py-0.5 text-[11px]">Scope: {scope}</span>
          <button onClick={logout} aria-label="Sign out" title="Sign out" className="shrink-0 rounded-lg p-1.5 hover:bg-white/10">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  )
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72">{nav}</div>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-4 top-4 rounded-lg bg-black/40 p-1.5 text-white"><X className="h-5 w-5" /></button>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-line bg-[color-mix(in_srgb,var(--page)_85%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5 sm:px-6">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2 lg:hidden"><Menu className="h-5 w-5" /></button>
          <div className="hidden min-w-0 text-sm font-semibold text-ink md:block md:w-44">{title}</div>
          <div className="flex flex-1 justify-center"><GlobalSearch /></div>
          {ov && <span className="hidden whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-[11px] text-muted xl:inline">Data as of {new Date(ov.as_of).toLocaleDateString()}</span>}
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      <Toaster />
    </div>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  return session ? <Layout>{children}</Layout> : <Navigate to="/login" replace />
}

function Routed() {
  const [session, setS] = useState<Session | null>(getSession)
  const navigate = useNavigate()
  const ctx = {
    session,
    login: (s: Session) => { setSession(s); setS(s); navigate('/') },
    logout: () => { setSession(null); setS(null); navigate('/login') },
  }
  return (
    <AuthCtx.Provider value={ctx}>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<Protected><Overview /></Protected>} />
        <Route path="/at-risk" element={<Protected><Students mode="risk" /></Protected>} />
        <Route path="/students" element={<Protected><Students mode="all" /></Protected>} />
        <Route path="/students/:id" element={<Protected><Student360 /></Protected>} />
        <Route path="/segments" element={<Protected><Segments /></Protected>} />
        <Route path="/interventions" element={<Protected><Interventions /></Protected>} />
        <Route path="/copilot" element={<Protected><Copilot /></Protected>} />
        <Route path="/data" element={<Protected><DataHub /></Protected>} />
        <Route path="/methodology" element={<Protected><Methodology /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthCtx.Provider>
  )
}

export default function App() {
  return <BrowserRouter><Routed /></BrowserRouter>
}
