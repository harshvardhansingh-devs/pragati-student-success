import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Bot, Database, GraduationCap, LayoutDashboard, ListChecks, LogOut, Menu, Moon, Scale, ShieldAlert, Sun, Users, X, Boxes } from 'lucide-react'
import { getSession, setSession, type Session } from './api'
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

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/at-risk', label: 'At-Risk Students', icon: ShieldAlert },
  { to: '/students', label: 'All Students', icon: Users },
  { to: '/segments', label: 'Segments', icon: Boxes },
  { to: '/interventions', label: 'Interventions', icon: ListChecks },
  { to: '/copilot', label: 'AI Copilot', icon: Bot },
  { to: '/data', label: 'Data Integration', icon: Database },
  { to: '/methodology', label: 'Score Methodology', icon: Scale },
]

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
    <button onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      className="rounded-lg p-2 text-nav-ink hover:bg-white/10">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

function Layout({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  const u = session!.user
  const scope = u.scope.dept ? `${u.scope.dept} department` : u.scope.mentor_id ? 'My mentees' : 'All departments'
  const nav = (
    <nav className="flex h-full flex-col bg-nav text-nav-ink">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-white"><GraduationCap className="h-5 w-5" /></div>
        <div>
          <div className="text-base font-semibold text-white">Pragati</div>
          <div className="text-[11px] leading-tight">Student Success Intelligence</div>
        </div>
      </div>
      <ul className="flex-1 space-y-0.5 px-3">
        {NAV.map((n) => (
          <li key={n.to}>
            <NavLink to={n.to} end={n.end}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-white/12 font-medium text-white' : 'hover:bg-white/6 hover:text-white'}`}>
              <n.icon className="h-4 w-4" aria-hidden /> {n.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 p-4">
        <div className="text-sm font-medium text-white">{u.name}</div>
        <div className="text-xs">{u.title}</div>
        <div className="mt-1 inline-block rounded bg-white/10 px-1.5 py-0.5 text-[11px]">Scope: {scope}</div>
        <div className="mt-3 flex items-center justify-between">
          <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs hover:bg-white/10">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">{nav}</aside>
      <div className="sticky top-0 z-20 flex items-center justify-between bg-nav px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2 text-white"><GraduationCap className="h-5 w-5" /> <span className="font-semibold">Pragati</span></div>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-white"><Menu className="h-5 w-5" /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{nav}</div>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-4 top-4 text-white"><X className="h-5 w-5" /></button>
        </div>
      )}
      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7">{children}</main>
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
