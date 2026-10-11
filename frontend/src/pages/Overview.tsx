import { useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, BookX, Briefcase, CalendarX, Info, ListChecks, Sparkles, TrendingDown, Users } from 'lucide-react'
import { useAuth } from '../App'
import { Heatmap, LineChart, StackedBar } from '../charts'
import { BandBadge, Card, ErrorBox, Kpi, Loading, PageHeader, RiskBadge, Trend, fmt, useApi } from '../ui'

const SEV = {
  high: { cls: 'border-l-critical', Icon: AlertTriangle, tag: 'Act now', tagCls: 'text-critical-text bg-critical/10' },
  medium: { cls: 'border-l-warn', Icon: Sparkles, tag: 'Opportunity', tagCls: 'text-warn-text bg-warn/15' },
  info: { cls: 'border-l-accent', Icon: Info, tag: 'Pattern', tagCls: 'text-accent-ink bg-accent-soft' },
} as const

export default function Overview() {
  const { data: d, error, loading } = useApi('/overview')
  const { session } = useAuth()
  const nav = useNavigate()
  if (loading && !d) return <Loading label="Crunching campus data…" />
  if (error) return <ErrorBox error={error} />
  if (!d) return null
  const k = d.kpis
  const depts: string[] = Object.keys(d.trend.series)
  const years = [1, 2, 3, 4]
  const hmRows = [...new Set(d.heatmap.map((h: any) => h.dept))] as string[]
  const cells: [number, number, number][] = d.heatmap.map((h: any) => [years.indexOf(h.year), hmRows.indexOf(h.dept), h.success_score])
  const bandColors: Record<string, string> = { Thriving: 'var(--good)', 'On track': 'var(--s1)', Watch: 'var(--warn)', 'At risk': 'var(--critical)' }
  const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v.slice(4, -1)).trim()

  return (
    <div>
      <PageHeader title={`Good day, ${session!.user.name.split(' ').slice(0, 2).join(' ')}`}
        subtitle={<>Student success snapshot · {k.students.toLocaleString()} students · {k.sources} integrated sources · data as of {new Date(d.as_of).toLocaleString()}</>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Students" value={k.students.toLocaleString()} icon={<Users className="h-3.5 w-3.5" />} sub="in your scope" onClick={() => nav('/students')} />
        <Kpi label="Avg Success Score" value={fmt(k.avg_success_score)} icon={<Activity className="h-3.5 w-3.5" />} sub="out of 100" onClick={() => nav('/methodology')} />
        <Kpi label="At-Risk: Academic" value={k.academic_high} tone="critical" icon={<BookX className="h-3.5 w-3.5" />} sub={`High · +${k.academic_medium} medium`} onClick={() => nav('/at-risk?tab=academic')} />
        <Kpi label="At-Risk: Placement" value={k.placement_high} tone="critical" icon={<Briefcase className="h-3.5 w-3.5" />} sub={`High · +${k.placement_medium} medium`} onClick={() => nav('/at-risk?tab=placement')} />
        <Kpi label="Sliding (4 wks)" value={k.sliding} tone="warn" icon={<TrendingDown className="h-3.5 w-3.5" />} sub="score fell ≥ 10 pts" onClick={() => nav('/at-risk?tab=sliding')} />
        <Kpi label="Below 75% attendance" value={k.below_75} tone="warn" icon={<CalendarX className="h-3.5 w-3.5" />} sub="detention risk" onClick={() => nav('/at-risk?tab=academic')} />
        <Kpi label="Open interventions" value={k.open_interventions} icon={<ListChecks className="h-3.5 w-3.5" />} sub="assigned actions" onClick={() => nav('/interventions')} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Key trends: average Success Score by department" subtitle="Weekly snapshots across the term (weeks 4–12). Hover for values.">
          <LineChart label="Weekly average success score by department" x={d.trend.weeks.map((w: number) => `Wk ${w}`)}
            series={depts.map((dep) => ({ name: dep, data: d.trend.series[dep] }))} height={290} />
        </Card>
        <Card className="xl:col-span-2" title="Student Success bands by department" subtitle="Thriving ≥75 · On track 60–74 · Watch 45–59 · At risk <45">
          <StackedBar label="Band distribution by department" categories={d.band_by_dept.depts}
            stacks={d.band_by_dept.bands.map((b: string, i: number) => ({ name: b, color: css(bandColors[b]), data: d.band_by_dept.values.map((r: number[]) => r[i]) }))} height={290} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title={<span className="inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-accent" /> AI insights</span>}
          subtitle="Generated automatically from patterns across all seven data sources">
          <ul className="space-y-2.5">
            {d.insights.map((i: any) => {
              const s = SEV[i.severity as keyof typeof SEV] ?? SEV.info
              return (
                <li key={i.title} className={`rounded-lg border border-line border-l-4 ${s.cls} bg-surface-2 p-3`}>
                  <div className="flex items-center gap-2">
                    <s.Icon className="h-4 w-4 text-ink-2" aria-hidden />
                    <span className="text-sm font-semibold">{i.title}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${s.tagCls}`}>{s.tag}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{i.text}</p>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card className="xl:col-span-2" title="Priority students" subtitle="Highest combined risk, with sliding students boosted" action={<button onClick={() => nav('/at-risk')} className="text-xs font-medium text-accent-ink hover:underline">View all →</button>}>
          <ul className="divide-y divide-line">
            {d.priority.map((s: any) => (
              <li key={s.student_id}>
                <button onClick={() => nav(`/students/${s.student_id}`)} className="flex w-full items-center justify-between gap-2 py-2.5 text-left hover:bg-surface-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-muted">{s.student_id} · {s.dept} Y{s.year} · score {fmt(s.success_score)} {s.sliding && <span className="font-medium text-critical-text">· sliding</span>}</div>
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

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2" title="Where scores are lowest" subtitle="Average Success Score, department × year">
          <Heatmap label="Average success score by department and year" rows={hmRows} cols={years.map((y) => `Year ${y}`)} cells={cells} height={260} />
        </Card>
        <Card className="xl:col-span-3" title="Risk flags by department" subtitle="Counts of students. Click a department to drill down.">
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
                    <td className="py-2 pr-3 font-medium">{r.dept}</td><td className="py-2 pr-3">{r.students}</td><td className="py-2 pr-3">{fmt(r.avg_score)}</td>
                    <td className="py-2 pr-3">{r.academic_high}</td><td className="py-2 pr-3">{r.placement_high}</td><td className="py-2 pr-3">{r.sliding}</td><td className="py-2">{r.below_75}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {d.segments.map((s: any) => (
              <button key={s.segment} onClick={() => nav(`/students?segment=${encodeURIComponent(s.segment)}`)}
                className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs hover:border-accent">
                {s.segment} <span className="font-semibold">{s.students}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted">Legend: <BandBadge band="Thriving" /> <BandBadge band="On track" /> <BandBadge band="Watch" /> <BandBadge band="At risk" /> · Trend arrows show 4-week score change, e.g. <Trend value={-12.4} /></p>
    </div>
  )
}
