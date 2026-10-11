import { useState, type FormEvent } from 'react'
import { KeyRound, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../App'
import { Button, Logo, Wordmark } from '../ui'

const DEMO = [
  { email: 'admin@prajna.demo', role: 'Principal / Admin', desc: 'Whole institution, edit score weights, upload data' },
  { email: 'hod.cse@prajna.demo', role: 'HoD, Computer Science', desc: 'CSE department only' },
  { email: 'mentor@prajna.demo', role: 'Faculty Mentor', desc: 'Own mentees only (CSE Year 3)' },
  { email: 'tpo@prajna.demo', role: 'Placement Officer', desc: 'Whole institution, placement focus' },
]
const DEMO_PASSWORD = 'Prajna@2026'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState(DEMO[0].email)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e?: FormEvent, override?: string) => {
    e?.preventDefault()
    setBusy(true)
    setError('')
    try {
      login(await api('/auth/login', { body: { email: override ?? email, password: override ? DEMO_PASSWORD : password } }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hero relative hidden flex-col justify-between overflow-hidden p-10 text-white/85 lg:flex">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" aria-hidden />
        <div className="relative flex items-center gap-3">
          <div className="rounded-xl ring-1 ring-white/30"><Logo size={44} /></div>
          <div><div className="text-xl font-semibold text-white">Prajna</div><div className="text-xs text-white/75">प्रज्ञा · insight for every student</div></div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight text-white">Know which students need help, why, and what to do next.</h1>
          <p className="mt-4 text-sm leading-relaxed">Prajna brings attendance, academics, LMS, engagement, placement, skills and feedback together into one Student 360 view.
            It computes an explainable Student Success Score, predicts academic and placement risk early, and turns every flag into a tracked intervention.</p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[['7', 'data sources unified'], ['23', 'indicators per student'], ['2', 'risk models + rules']].map(([n, l]) => (
              <div key={l} className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15"><div className="text-2xl font-semibold text-white">{n}</div><div className="text-[11px] leading-tight">{l}</div></div>
            ))}
          </div>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex gap-2"><Users className="h-4 w-4 shrink-0 text-white" /> 7 data sources, one unified student view</li>
            <li className="flex gap-2"><Sparkles className="h-4 w-4 shrink-0 text-white" /> Explainable scores, risk drivers and what-if simulation</li>
            <li className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-white" /> Role-based access, audit log, fairness checks</li>
          </ul>
        </div>
        <p className="relative text-xs">Demo uses synthetic data for 1,200 students. No real student data.</p>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <Wordmark size={36} />
          </div>
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-ink-2">Choose a demo role for one-click access, or sign in below.</p>

          <div className="mt-5 grid gap-2">
            {DEMO.map((d) => (
              <button key={d.email} onClick={() => submit(undefined, d.email)} disabled={busy}
                className="card flex items-center justify-between gap-3 p-3 text-left transition hover:border-accent hover:shadow-sm disabled:opacity-60">
                <div>
                  <div className="text-sm font-medium">{d.role}</div>
                  <div className="text-xs text-muted">{d.desc}</div>
                </div>
                <span className="text-xs font-medium text-accent-ink">Enter →</span>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-3 border-t border-line pt-5">
            <label className="block text-sm">
              <span className="text-ink-2">Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="username"
                className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" />
            </label>
            <label className="block text-sm">
              <span className="text-ink-2">Password</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="current-password"
                className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" />
            </label>
            {error && <p className="text-sm text-critical-text" role="alert">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">Sign in</Button>
            <p className="flex items-center gap-1.5 text-xs text-muted"><KeyRound className="h-3.5 w-3.5" /> Demo password for all accounts: <code className="font-mono text-ink-2">{DEMO_PASSWORD}</code></p>
          </form>
        </div>
      </div>
    </div>
  )
}
