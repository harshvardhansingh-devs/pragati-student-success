import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bot, FlaskConical, Lightbulb, MessageSquareQuote, ShieldAlert } from 'lucide-react'
import { api } from '../api'
import { Diverging, LineChart, Radar } from '../charts'
import { BandBadge, Button, Card, DOMAINS, DOMAIN_LABEL, ErrorBox, Loading, RiskBadge, Trend, fmt, pct, useApi } from '../ui'
import AssignPanel from './AssignPanel'

const SIM_FIELDS = ['attendance_term', 'attendance_recent', 'assignment_completion', 'internal_avg', 'coding', 'aptitude', 'mock_interviews', 'certifications']
const SOURCES = ['Academic', 'Attendance', 'LMS', 'Engagement', 'Placement', 'Skills', 'Feedback', 'Skills / Engagement']

export default function Student360() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data: d, error, loading, reload } = useApi(`/students/${id}`)
  const [sim, setSim] = useState<Record<string, number>>({})
  const [simRes, setSimRes] = useState<any>(null)
  const [brief, setBrief] = useState<any>(null)
  const [briefBusy, setBriefBusy] = useState(false)
  const [assign, setAssign] = useState<any>(null)

  if (loading && !d) return <Loading label="Building Student 360…" />
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
    try { setBrief(await api(`/students/${id}/brief`, { method: 'POST' })) } finally { setBriefBusy(false) }
  }
  const waterfall = d.explanation.items.filter((i: any) => i.vs_cohort !== null).sort((a: any, b: any) => Math.abs(b.vs_cohort) - Math.abs(a.vs_cohort)).slice(0, 12)

  return (
    <div>
      <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back</button>

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <p className="mt-1 text-sm text-ink-2">{p.student_id} · {p.program} {p.dept} · Year {p.year} · Section {p.section} · Mentor {p.mentor_id}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink">Segment: {sc.segment}</span>
            {sc.sliding && <span className="rounded-full bg-critical/10 px-2 py-0.5 text-xs font-medium text-critical-text">Sliding: score fell {Math.abs(sc.trend_4w).toFixed(1)} pts in 4 weeks</span>}
            {sc.low_confidence && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-medium text-warn-text">Low confidence: missing data</span>}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-muted">Student Success Score</div>
            <div className="text-5xl font-semibold leading-none">{fmt(sc.success_score, 0)}<span className="text-lg text-muted">/100</span></div>
            <div className="mt-1.5 flex items-center justify-end gap-2"><BandBadge band={sc.band} /><Trend value={sc.trend_4w} /></div>
            <div className="mt-1 text-xs text-muted">{fmt(sc.cohort_percentile, 0)}th percentile in {p.dept} Y{p.year} (avg {fmt(sc.cohort_avg, 0)})</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(['academic', 'placement'] as const).map((k) => {
          const r = d.risk[k]
          return (
            <Card key={k} title={<span className="inline-flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" /> {k === 'academic' ? 'Academic' : 'Placement'} risk flag</span>}
              subtitle={k === 'academic' ? 'Chance of a new backlog or SGPA below 6 next semester' : 'Chance of not being placement-ready by placement season'}
              action={<div className="text-right"><RiskBadge tier={r.tier} /><div className="mt-1 text-xs text-muted">{pct(r.probability)} model probability</div></div>}>
              {r.rules.length > 0 && <div className="mb-2 rounded-lg bg-critical/10 p-2 text-sm text-critical-text">Rule triggered: {r.rules.join('; ')}</div>}
              <div className="text-xs font-medium text-muted">Why: top drivers (explainable AI)</div>
              {r.drivers.length && r.tier !== 'Low' ? (
                <ul className="mt-1.5 space-y-2">
                  {r.drivers.map((x: any) => (
                    <li key={x.feature} className="flex items-center justify-between gap-3 text-sm">
                      <span>{x.label}: <b>{fmt(x.value, x.value % 1 ? 1 : 0)}</b> <span className="text-muted">(cohort median {fmt(x.cohort_median, 1)})</span></span>
                      <span className="w-24 shrink-0"><span className="block h-1.5 rounded-full bg-critical" style={{ width: `${Math.min(100, x.impact * 80)}%` }} title={`impact ${x.impact}`} /></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-ink-2">No significant risk drivers, indicators are at or above the cohort.</p>}
            </Card>
          )
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Domain profile vs cohort" subtitle="Six domain sub-scores (0–100) against the dept × year average">
          <Radar label="Domain scores vs cohort" indicators={DOMAINS.map((x) => DOMAIN_LABEL[x])}
            series={[{ name: p.name.split(' ')[0], data: DOMAINS.map((x) => sc.domains[x]) }, { name: 'Cohort avg', data: DOMAINS.map((x) => sc.cohort_domains[x]) }]} />
        </Card>
        <Card title="What drives the score" subtitle="Each indicator's points contribution vs the cohort average (explainable score)">
          <Diverging label="Score contribution vs cohort by indicator" labels={waterfall.map((w: any) => w.label)} values={waterfall.map((w: any) => w.vs_cohort)} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Success Score trend" subtitle="Weekly snapshots this term vs cohort average">
          <LineChart label="Weekly success score" x={d.history.weeks.map((w: number) => `Wk ${w}`)} height={240}
            series={[{ name: 'Student', data: d.history.score }, { name: 'Cohort avg', data: d.history.cohort, dashed: true, color: 'var(--muted)' }]}
            colors={[getComputedStyle(document.documentElement).getPropertyValue('--s1').trim(), '#898781']} />
        </Card>
        <Card className="lg:col-span-2" title={<span className="inline-flex items-center gap-1.5"><FlaskConical className="h-4 w-4" /> What-if simulator</span>} subtitle="Move a target and see the score and risk change">
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={<span className="inline-flex items-center gap-1.5"><Lightbulb className="h-4 w-4" /> Recommended interventions</span>} subtitle="Generated from this student's risk drivers and segment playbook">
          {assign && <AssignPanel ids={[p.student_id]} preset={[assign.action, assign.owner]} reason={assign.reason} onDone={() => { setAssign(null); reload() }} />}
          <ul className="space-y-2">
            {d.recommendations.map((r: any) => (
              <li key={r.action} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
                <div><div className="text-sm font-medium">{r.action}</div><div className="text-xs text-muted">Owner: {r.owner} · because: {r.reason}</div></div>
                <Button variant="outline" onClick={() => setAssign(r)}>Assign</Button>
              </li>
            ))}
            {!d.recommendations.length && <li className="text-sm text-ink-2">No interventions needed. Consider this student as a peer mentor.</li>}
          </ul>
          {d.interventions.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-muted">Intervention history</div>
              <ul className="mt-1 divide-y divide-line text-sm">
                {d.interventions.map((iv: any) => <li key={iv.id} className="flex justify-between py-1.5"><span>{iv.action}</span><span className="text-xs text-muted">{iv.status} · due {iv.due_date}</span></li>)}
              </ul>
            </div>
          )}
        </Card>
        <Card title={<span className="inline-flex items-center gap-1.5"><Bot className="h-4 w-4" /> AI mentor brief</span>} subtitle="One-click briefing before a mentor meeting (IDs and numbers only are sent to the AI)"
          action={<Button onClick={getBrief} disabled={briefBusy}>{briefBusy ? 'Generating…' : brief ? 'Regenerate' : 'Generate'}</Button>}>
          {brief ? <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">{brief.brief}</pre> : <p className="text-sm text-ink-2">Generate a short brief with strengths, concerns, talking points and a suggested action.</p>}
          {brief && <p className="mt-2 text-xs text-muted">Source: {brief.source === 'ai' ? brief.provider : 'rule-based template (no AI provider available)'}</p>}
          {p.comments && <div className="mt-4 flex gap-2 rounded-lg bg-surface-2 p-3 text-sm text-ink-2"><MessageSquareQuote className="h-4 w-4 shrink-0" /> Student feedback: "{p.comments}"</div>}
        </Card>
      </div>

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
