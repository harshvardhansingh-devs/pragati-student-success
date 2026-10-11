import { useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowRight, BookX, Bot, Briefcase, CalendarX, GraduationCap, Info, ListChecks, Sparkles, TrendingDown, Users } from 'lucide-react'
import { useAuth } from '../App'
import { Heatmap, LineChart, StackedBar } from '../charts'
import { Avatar, Card, ErrorBox, PageSkeleton, RiskBadge, Sparkline, fmt, useApi } from '../ui'

const SEV = {
  high: { cls: 'border-l-critical', Icon: AlertTriangle, tag: 'Act now', tagCls: 'text-critical-text bg-critical/10' },
  medium: { cls: 'border-l-warn', Icon: Sparkles, tag: 'Opportunity', tagCls: 'text-warn-text bg-warn/15' },
  info: { cls: 'border-l-accent', Icon: Info, tag: 'Pattern', tagCls: 'text-accent-ink bg-accent-soft' },
} as const
// Where each insight's "view students" link goes
const INSIGHT_LINK: Record<string, string> = {
  'Detention watch': '/students?below_75=true', 'Sliding students': '/at-risk?tab=sliding', 'Hidden placement gap': '/students?placement_risk=High&year=3,4',
  'Segment opportunity': `/students?segment=${encodeURIComponent('Academic Star, Placement-Unready')}`, 'LMS signal': '/at-risk?tab=academic',
}

function Kpi({ label, value, sub, icon, tone, onClick, children }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ReactNode; tone: string; onClick?: () => void; children?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="card group min-w-0 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}>{icon}</span>
        {children}
      </div>
      <div className="mt-3 text-[26px] font-semibold leading-none tracking-tight text-ink tnum">{value}</div>
      <div className="mt-1.5 text-xs font-medium text-ink-2">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </button>
  )
}

export default function Overview() {
  const { data: d, error, loading } = useApi('/overview')
  const { session } = useAuth()
  const nav = useNavigate()
  if (loading && !d) return <PageSkeleton />
  if (error) return <ErrorBox error={error} />
  if (!d) return null
  const k = d.kpis
  const u = session!.user
  const depts: string[] = Object.keys(d.trend.series)
  const years = [1, 2, 3, 4]
  const hmRows = [...new Set(d.heatmap.map((h: any) => h.dept))] as string[]
  const cells: [number, number, number][] = d.heatmap.map((h: any) => [years.indexOf(h.year), hmRows.indexOf(h.dept), h.success_score])
  const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()
  const bandColors: Record<string, string> = { Thriving: '--good', 'On track': '--s1', Watch: '--warn', 'At risk': '--critical' }
  const trendDelta = d.trend.overall.length > 4 ? d.trend.overall[d.trend.overall.length - 1] - d.trend.overall[d.trend.overall.length - 5] : 0
  const needAttention = k.needs_attention
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const actions = [
    { n: k.below_75, title: 'Below 75% attendance', text: 'Detention risk this semester. Start attendance counselling and parent connect.', to: '/students?below_75=true', icon: CalendarX, tone: 'var(--critical)' },
    { n: k.sliding, title: 'Sliding fast', text: 'Score fell 10+ points in 4 weeks. Some still look "on track". Reach out this week.', to: '/at-risk?tab=sliding', icon: TrendingDown, tone: 'var(--serious)' },
    { n: k.senior_placement_high, title: 'Seniors not placement-ready', text: 'Year 3–4 students at High placement risk. Enrol them in a bootcamp and mock interviews.', to: '/students?placement_risk=High&year=3,4', icon: Briefcase, tone: 'var(--s7)' },
    { n: k.star_unready, title: 'Toppers, placement-unready', text: 'Strong academics but weak coding and mock-interview record. One bootcamp can lift the whole group.', to: `/students?segment=${encodeURIComponent('Academic Star, Placement-Unready')}`, icon: GraduationCap, tone: 'var(--s1)' },
  ]

  return (
    <div className="space-y-4">
      <section className="hero relative overflow-hidden rounded-2xl p-5 sm:p-7">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-20 right-40 h-48 w-48 rounded-full bg-white/5" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-sm text-white/80">{greet}, {u.name.split(' ').slice(0, 2).join(' ')} · {u.title}</p>
            <h1 className="mt-1 text-2xl font-semibold leading-snug tracking-tight sm:text-[28px]">
              {needAttention} students are at high risk, and {k.sliding} are sliding fast.
            </h1>
            <p className="mt-2 text-sm text-white/85">
              Average Student Success Score is <b>{fmt(k.avg_success_score)}</b> across {k.students.toLocaleString()} students, built from {k.sources} integrated data sources. Start with the actions below.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => nav('/at-risk')} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-[#1c5cab] shadow hover:bg-white/90">Review at-risk students <ArrowRight className="h-4 w-4" /></button>
            <button onClick={() => nav('/copilot')} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/15 px-4 text-sm font-medium text-white ring-1 ring-white/30 hover:bg-white/25"><Bot className="h-4 w-4" /> Ask AI Copilot</button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Avg Student Success Score" value={fmt(k.avg_success_score)} sub={`${trendDelta >= 0 ? '+' : ''}${trendDelta.toFixed(1)} over 4 weeks`} icon={<Activity className="h-4 w-4" />} tone="var(--s1)" onClick={() => nav('/methodology')}>
          <span className="text-accent"><Sparkline data={d.trend.overall} width={72} height={26} color="var(--s1)" /></span>
        </Kpi>
        <Kpi label="Students" value={k.students.toLocaleString()} sub="in your scope" icon={<Users className="h-4 w-4" />} tone="var(--s7)" onClick={() => nav('/students')} />
        <Kpi label="At-Risk: Academic" value={k.academic_high} sub={`High · +${k.academic_medium} medium`} icon={<BookX className="h-4 w-4" />} tone="var(--critical)" onClick={() => nav('/at-risk?tab=academic')} />
        <Kpi label="At-Risk: Placement" value={k.placement_high} sub={`High · +${k.placement_medium} medium`} icon={<Briefcase className="h-4 w-4" />} tone="var(--critical)" onClick={() => nav('/at-risk?tab=placement')} />
        <Kpi label="Sliding (4 weeks)" value={k.sliding} sub="score fell ≥ 10 points" icon={<TrendingDown className="h-4 w-4" />} tone="var(--serious)" onClick={() => nav('/at-risk?tab=sliding')} />
        <Kpi label="Open interventions" value={k.open_interventions} sub="assigned actions" icon={<ListChecks className="h-4 w-4" />} tone="var(--good)" onClick={() => nav('/interventions')} />
      </div>

      <Card title="Action center" subtitle="The four groups that need a decision this week. Click one to see the students and assign an intervention.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((a) => (
            <button key={a.title} onClick={() => nav(a.to)} className="group flex flex-col rounded-xl border border-line bg-surface-2 p-4 text-left transition hover:border-accent hover:bg-surface">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: a.tone }}><a.icon className="h-4 w-4" /></span>
                <span className="text-2xl font-semibold tnum">{a.n}</span>
              </div>
              <div className="mt-2 text-sm font-semibold">{a.title}</div>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-2">{a.text}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-ink">View students <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Key trends: average Success Score by department" subtitle="Weekly snapshots across the term (weeks 4–12). Hover for values.">
          <LineChart label="Weekly average success score by department" x={d.trend.weeks.map((w: number) => `Wk ${w}`)}
            series={depts.map((dep) => ({ name: dep, data: d.trend.series[dep] }))} height={290} />
        </Card>
        <Card className="xl:col-span-2" title="Success bands by department" subtitle="Thriving ≥75 · On track 60–74 · Watch 45–59 · At risk <45">
          <StackedBar label="Band distribution by department" categories={d.band_by_dept.depts}
            stacks={d.band_by_dept.bands.map((b: string, i: number) => ({ name: b, color: css(bandColors[b]), data: d.band_by_dept.values.map((r: number[]) => r[i]) }))} height={290} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title={<span className="inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-accent" /> AI insights</span>}
          subtitle="Found automatically by cross-checking all seven data sources">
          <ul className="space-y-2.5">
            {d.insights.map((i: any) => {
              const s = SEV[i.severity as keyof typeof SEV] ?? SEV.info
              const link = INSIGHT_LINK[i.title]
              return (
                <li key={i.title} className={`rounded-xl border border-line border-l-4 ${s.cls} bg-surface-2 p-3`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <s.Icon className="h-4 w-4 text-ink-2" aria-hidden />
                    <span className="text-sm font-semibold">{i.title}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${s.tagCls}`}>{s.tag}</span>
                    {link && <button onClick={() => nav(link)} className="ml-auto rounded-md px-1.5 py-1.5 text-xs font-semibold text-accent-ink hover:underline">View students →</button>}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{i.text}</p>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card className="xl:col-span-2" title="Priority students" subtitle="Highest combined risk; sliding students boosted" action={<button onClick={() => nav('/at-risk')} className="rounded-md px-1.5 py-1.5 text-xs font-semibold text-accent-ink hover:underline">View all →</button>}>
          <ul className="divide-y divide-line">
            {d.priority.map((s: any) => (
              <li key={s.student_id}>
                <button onClick={() => nav(`/students/${s.student_id}`)} className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left hover:bg-surface-2">
                  <Avatar name={s.name} band={s.band} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <div className="truncate text-xs text-muted">{s.dept} Y{s.year} · score {fmt(s.success_score, 0)}{s.sliding && <span className="font-semibold text-critical-text"> · sliding {fmt(s.trend_4w)}</span>}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {s.academic_risk !== 'Low' && <RiskBadge tier={s.academic_risk} label="Acad" />}
                    {s.placement_risk !== 'Low' && <RiskBadge tier={s.placement_risk} label="Place" />}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2" title="Where scores are lowest" subtitle="Average Success Score, department × year">
          <Heatmap label="Average success score by department and year" rows={hmRows} cols={years.map((y) => `Year ${y}`)} cells={cells} height={260} />
        </Card>
        <Card className="xl:col-span-3" title="Risk flags by department" subtitle="Number of students. Click a row to drill down.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm tnum">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Dept</th><th className="py-2 pr-3 font-medium">Students</th><th className="py-2 pr-3 font-medium">Avg score</th>
                  <th className="py-2 pr-3 font-medium">At-Risk: Academic</th><th className="py-2 pr-3 font-medium">At-Risk: Placement</th>
                  <th className="py-2 pr-3 font-medium">Sliding</th><th className="py-2 font-medium">&lt;75% attendance</th>
                </tr>
              </thead>
              <tbody>
                {d.by_dept.map((r: any) => (
                  <tr key={r.dept} onClick={() => nav(`/students?dept=${r.dept}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="py-2.5 pr-3 font-semibold">{r.dept}</td><td className="py-2.5 pr-3">{r.students}</td><td className="py-2.5 pr-3">{fmt(r.avg_score)}</td>
                    <td className="py-2.5 pr-3">{r.academic_high}</td><td className="py-2.5 pr-3">{r.placement_high}</td><td className="py-2.5 pr-3">{r.sliding}</td><td className="py-2.5">{r.below_75}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-xs font-medium text-muted">Student segments</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {d.segments.map((s: any) => (
              <button key={s.segment} onClick={() => nav(`/students?segment=${encodeURIComponent(s.segment)}`)}
                className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs hover:border-accent">
                {s.segment} <span className="font-semibold">{s.students}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
