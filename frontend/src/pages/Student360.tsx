import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bot, FlaskConical, Lightbulb, MessageSquareQuote, ShieldAlert } from 'lucide-react'
import { api } from '../api'
import { Diverging, LineChart, Radar } from '../charts'
import { Avatar, BandBadge, Button, Card, DOMAINS, DOMAIN_LABEL, ErrorBox, PageSkeleton, RichText, RiskBadge, ScoreRing, Trend, fmt, pct, toast, useApi } from '../ui'
import AssignPanel from './AssignPanel'

const SIM_FIELDS = ['attendance_term', 'attendance_recent', 'assignment_completion', 'internal_avg', 'coding', 'aptitude', 'mock_interviews', 'certifications']
const SOURCES = ['Academic', 'Attendance', 'LMS', 'Engagement', 'Placement', 'Skills', 'Feedback', 'Skills / Engagement']

// Student-facing wording: supportive, never 'risk'
const STUDENT_TIER: Record<string, string> = { High: 'Needs attention', Medium: 'Keep an eye on it', Low: 'On track' }

/** Staff view of any student, or (selfId) a student's own "My Progress" view: same data, supportive wording, no staff actions. */
export default function Student360({ selfId }: { selfId?: string }) {
  const params = useParams()
  const id = selfId ?? params.id
  const self = !!selfId
  const nav = useNavigate()
  const { data: d, error, loading, reload } = useApi(`/students/${id}`)
  const [sim, setSim] = useState<Record<string, number>>({})
  const [simRes, setSimRes] = useState<any>(null)
  const [brief, setBrief] = useState<any>(null)
  const [briefBusy, setBriefBusy] = useState(false)
  const [assign, setAssign] = useState<any>(null)

  if (loading && !d) return <PageSkeleton />
  if (error) return <ErrorBox error={error} />
  if (!d) return null
  const p = d.profile, sc = d.score
  const ind = Object.fromEntries(d.indicators.map((i: any) => [i.feature, i]))

  const runSim = async (next: Record<string, number>) => {
    setSim(next)
    if (!Object.keys(next).length) return setSimRes(null)
    setSimRes(await api(`/students/${id}/simulate`, { body: { overrides: next } }))
  }
  const getBrief = async () => {
    setBriefBusy(true)
    try { setBrief(await api(`/students/${id}/brief`, { method: 'POST' })) } catch (e: any) { toast(e.message, 'error') } finally { setBriefBusy(false) }
  }
  const waterfall = d.explanation.items.filter((i: any) => i.vs_cohort !== null).sort((a: any, b: any) => Math.abs(b.vs_cohort) - Math.abs(a.vs_cohort)).slice(0, 12)

  return (
    <div>
      {self ? <p className="mb-3 text-sm text-ink-2">Welcome back, {p.name.split(' ')[0]}. Here's where you stand this term and what would help most.</p>
        : <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back</button>}

      <div className="card mb-4 overflow-hidden">
        <div className="hero h-16 sm:h-20" aria-hidden />
        <div className="flex flex-wrap items-end justify-between gap-5 px-5 pb-5">
          <div className="flex min-w-0 flex-col gap-2 sm:-mt-8 sm:flex-row sm:items-end sm:gap-4">
            <div className="-mt-9 self-start rounded-full ring-4 ring-[var(--surface)] sm:mt-0"><Avatar name={p.name} band={sc.band} size={72} /></div>
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{p.name}</h1>
              <p className="mt-0.5 text-sm text-ink-2">{p.student_id} · {p.program} {p.dept} · Year {p.year} · Section {p.section} · Mentor {p.mentor_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ScoreRing score={sc.success_score} size={88} stroke={8} />
            <div>
              <div className="text-xs font-medium text-muted">Student Success Score</div>
              <div className="mt-1 flex items-center gap-2"><BandBadge band={sc.band} /><Trend value={sc.trend_4w} /></div>
              <div className="mt-1 text-xs text-muted">{fmt(sc.cohort_percentile, 0)}th percentile in {p.dept} Y{p.year} · cohort avg {fmt(sc.cohort_avg, 0)}</div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink">Segment: {sc.segment}</span>
          <RiskBadge tier={d.risk.academic.tier} label="Academic risk" text={self ? `Academics: ${STUDENT_TIER[d.risk.academic.tier]}` : undefined} />
          <RiskBadge tier={d.risk.placement.tier} label="Placement risk" text={self ? `Placement: ${STUDENT_TIER[d.risk.placement.tier]}` : undefined} />
          {sc.sliding && <span className="rounded-full bg-critical/10 px-2.5 py-1 text-xs font-medium text-critical-text">Sliding: −{Math.abs(sc.trend_4w).toFixed(1)} pts in 4 weeks</span>}
          {sc.low_confidence && <span className="rounded-full bg-warn/15 px-2.5 py-1 text-xs font-medium text-warn-text">Low confidence: missing data</span>}
          <nav className="-mx-1 flex w-full gap-1 overflow-x-auto text-xs sm:mx-0 sm:ml-auto sm:w-auto sm:flex-wrap" aria-label="Sections">
            {[['risk', 'Risk'], ['drivers', 'Drivers'], ['whatif', 'What-if'], ['actions', 'Actions'], ['data', 'All data']].map(([id, l]) => (
              <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                className="shrink-0 rounded-lg px-2.5 py-2 font-medium text-ink-2 hover:bg-surface-2 hover:text-ink sm:py-1">{l}</a>
            ))}
          </nav>
        </div>
      </div>

      <div id="risk" className="grid scroll-mt-20 gap-4 lg:grid-cols-2">
        {(['academic', 'placement'] as const).map((k) => {
          const r = d.risk[k]
          return (
            <Card key={k} title={<span className="inline-flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" /> {self ? (k === 'academic' ? 'Academic outlook' : 'Placement readiness') : `${k === 'academic' ? 'Academic' : 'Placement'} risk flag`}</span>}
              subtitle={self ? (k === 'academic' ? 'Based on your marks, attendance and LMS activity' : 'Based on your aptitude, coding, skills and mock interviews')
                : k === 'academic' ? 'Chance of a new backlog or SGPA below 6 next semester' : 'Chance of not being placement-ready by placement season'}
              action={self ? <RiskBadge tier={r.tier} text={STUDENT_TIER[r.tier]} /> : <div className="text-right"><RiskBadge tier={r.tier} /><div className="mt-1 text-xs text-muted">{pct(r.probability)} model probability</div></div>}>
              {r.rules.length > 0 && <div className="mb-2 rounded-lg bg-critical/10 p-2 text-sm text-critical-text">{self ? 'Important: ' : 'Rule triggered: '}{r.rules.join('; ')}</div>}
              <div className="text-xs font-medium text-muted">{self ? "What's holding this back" : 'Why: top drivers (explainable AI)'}</div>
              {r.drivers.length && r.tier !== 'Low' ? (
                <ul className="mt-1.5 space-y-2">
                  {r.drivers.map((x: any) => (
                    <li key={x.feature} className="flex items-center justify-between gap-3 text-sm">
                      <span>{x.label}: <b>{fmt(x.value, x.value % 1 ? 1 : 0)}</b> <span className="text-muted">(median of all students {fmt(x.cohort_median, 1)})</span></span>
                      <span className="w-24 shrink-0"><span className="block h-1.5 rounded-full bg-critical" style={{ width: `${Math.min(100, x.impact * 80)}%` }} title={`impact ${x.impact}`} /></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-ink-2">{self ? "You're at or above your classmates here. Keep it up!" : 'No significant risk drivers, indicators are at or above the cohort.'}</p>}
            </Card>
          )
        })}
      </div>

      <div id="drivers" className="mt-4 grid scroll-mt-20 gap-4 lg:grid-cols-2">
        <Card title="Domain profile vs cohort" subtitle="Six domain sub-scores (0–100) against the dept × year average">
          <Radar label="Domain scores vs cohort" indicators={DOMAINS.map((x) => DOMAIN_LABEL[x])}
            series={[{ name: p.name.split(' ')[0], data: DOMAINS.map((x) => sc.domains[x]) }, { name: 'Cohort avg', data: DOMAINS.map((x) => sc.cohort_domains[x]) }]} />
        </Card>
        <Card title="What drives the score" subtitle="Each indicator's points contribution vs the cohort average (explainable score)">
          <Diverging label="Score contribution vs cohort by indicator" labels={waterfall.map((w: any) => w.label)} values={waterfall.map((w: any) => w.vs_cohort)} />
        </Card>
      </div>

      <div id="whatif" className="mt-4 grid scroll-mt-20 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Success Score trend" subtitle="Weekly snapshots this term vs cohort average">
          <LineChart label="Weekly success score" x={d.history.weeks.map((w: number) => `Wk ${w}`)} height={240}
            series={[{ name: 'Student', data: d.history.score }, { name: 'Cohort avg', data: d.history.cohort, dashed: true, color: 'var(--muted)' }]}
            colors={[getComputedStyle(document.documentElement).getPropertyValue('--s1').trim(), '#898781']} />
        </Card>
        <Card className="lg:col-span-2" title={<span className="inline-flex items-center gap-1.5"><FlaskConical className="h-4 w-4" /> {self ? 'Goal simulator' : 'What-if simulator'}</span>} subtitle={self ? 'Set a target and see how your score could change' : 'Move a target and see the score and risk change'}>
          <div className="space-y-2.5">
            {SIM_FIELDS.map((f) => {
              const i = ind[f]
              const cur = sim[f] ?? i.value ?? i.lo
              return (
                <label key={f} className="block text-xs">
                  <span className="flex justify-between text-ink-2"><span>{i.label}</span><span className="tnum font-medium text-ink">{fmt(cur, 0)}{sim[f] !== undefined && <span className="text-muted"> (was {fmt(i.value, 0)})</span>}</span></span>
                  <input type="range" className="w-full" min={i.lo} max={i.hi} step={(i.hi - i.lo) / 50} value={cur}
                    onChange={(e) => setSim({ ...sim, [f]: Number(e.target.value) })}
                    onMouseUp={(e) => runSim({ ...sim, [f]: Number(e.currentTarget.value) })} onTouchEnd={(e) => runSim({ ...sim, [f]: Number(e.currentTarget.value) })}
                    onKeyUp={(e) => runSim({ ...sim, [f]: Number(e.currentTarget.value) })} />
                </label>
              )
            })}
          </div>
          {simRes && (
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-surface-2 p-3 text-center text-xs">
              <div><div className="text-muted">Score</div><div className="text-sm font-semibold">{fmt(simRes.before.success_score, 0)} → {fmt(simRes.after.success_score, 0)}</div></div>
              <div><div className="text-muted">Academic risk</div><div className="text-sm font-semibold">{pct(simRes.before.academic_risk_prob)} → {pct(simRes.after.academic_risk_prob)}</div></div>
              <div><div className="text-muted">Placement risk</div><div className="text-sm font-semibold">{pct(simRes.before.placement_risk_prob)} → {pct(simRes.after.placement_risk_prob)}</div></div>
            </div>
          )}
          {Object.keys(sim).length > 0 && <button onClick={() => runSim({})} className="mt-2 text-xs text-accent-ink hover:underline">Reset</button>}
        </Card>
      </div>

      <div id="actions" className="mt-4 grid scroll-mt-20 gap-4 lg:grid-cols-2">
        <Card title={<span className="inline-flex items-center gap-1.5"><Lightbulb className="h-4 w-4" /> {self ? 'Suggested next steps' : 'Recommended interventions'}</span>} subtitle={self ? "Based on what's holding your score back" : "Generated from this student's risk drivers and segment playbook"}>
          {assign && <AssignPanel ids={[p.student_id]} preset={[assign.action, assign.owner]} reason={assign.reason} onDone={() => { setAssign(null); reload() }} />}
          <ul className="space-y-2">
            {d.recommendations.map((r: any) => (
              <li key={r.action} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
                <div><div className="text-sm font-medium">{r.action}</div><div className="text-xs text-muted">{self ? `Who can help: ${r.owner} · why: ${r.reason.replace(/ \((academic|placement) risk\)/, '')}` : `Owner: ${r.owner} · because: ${r.reason}`}</div></div>
                {!self && <Button variant="outline" onClick={() => setAssign(r)}>Assign</Button>}
              </li>
            ))}
            {!d.recommendations.length && <li className="text-sm text-ink-2">No interventions needed. Consider this student as a peer mentor.</li>}
          </ul>
          {d.interventions.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-muted">{self ? 'Support assigned to you' : 'Intervention history'}</div>
              <ul className="mt-1 divide-y divide-line text-sm">
                {d.interventions.map((iv: any) => <li key={iv.id} className="flex justify-between py-1.5"><span>{iv.action}</span><span className="text-xs text-muted">{iv.status} · due {iv.due_date}</span></li>)}
              </ul>
            </div>
          )}
        </Card>
        <Card title={<span className="inline-flex items-center gap-1.5"><Bot className="h-4 w-4" /> {self ? 'My AI coach' : 'AI mentor brief'}</span>} subtitle={self ? 'Personal tips from your data (only numbers are sent to the AI, never your name)' : 'One-click briefing before a mentor meeting (IDs and numbers only are sent to the AI)'}
          action={<Button onClick={getBrief} disabled={briefBusy}>{briefBusy ? 'Generating…' : brief ? 'Regenerate' : self ? 'Get my tips' : 'Generate'}</Button>}>
          {brief ? <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink"><RichText text={brief.brief} /></pre> : <p className="text-sm text-ink-2">{self ? 'Get your strengths, one focus area and a plan for this week.' : 'Generate a short brief with strengths, concerns, talking points and a suggested action.'}</p>}
          {brief && <p className="mt-2 text-xs text-muted">Source: {brief.source === 'ai' ? brief.provider : 'rule-based template (no AI provider available)'}</p>}
          {p.comments && <div className="mt-4 flex gap-2 rounded-lg bg-surface-2 p-3 text-sm text-ink-2"><MessageSquareQuote className="h-4 w-4 shrink-0" /> {self ? 'Your feedback' : 'Student feedback'}: "{p.comments}"</div>}
        </Card>
      </div>

      <div id="data" className="scroll-mt-20" />
      <Card className="mt-4" title="Unified Student 360: all indicators by source" subtitle="Raw values after cleaning and integration, compared with the cohort median">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {SOURCES.filter((s) => d.indicators.some((i: any) => i.source === s)).map((s) => (
            <div key={s}>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{s}</div>
              <ul className="space-y-1.5">
                {d.indicators.filter((i: any) => i.source === s).map((i: any) => {
                  const worse = i.value !== null && i.cohort_median !== null && (i.higher_is_better ? i.value < i.cohort_median : i.value > i.cohort_median)
                  return (
                    <li key={i.feature} className="flex justify-between gap-2 text-sm">
                      <span className="text-ink-2">{i.label}</span>
                      <span className="tnum"><b className={worse ? 'text-critical-text' : ''}>{fmt(i.value, i.value !== null && i.value % 1 ? 1 : 0)}</b> <span className="text-xs text-muted">/ {fmt(i.cohort_median, 1)}</span></span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
        {d.sgpa.length > 0 && <p className="mt-4 text-xs text-muted">SGPA history: {d.sgpa.map((s: any) => `Sem ${s.semester}: ${fmt(s.sgpa, 2)}`).join(' · ')}</p>}
      </Card>
    </div>
  )
}
