import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { qs } from '../api'
import { Avatar, BandBadge, Card, Empty, ErrorBox, PageHeader, RiskBadge, ScoreRing, Select, Skeleton, Trend, fmt, pct, useApi } from '../ui'
import AssignPanel from './AssignPanel'

const SEGMENTS = ['All-rounders', 'Academic Star, Placement-Unready', 'Campus-Active, Placement-Unready', 'Engaged but Struggling', 'Silent Disengager', 'Multi-domain Risk']
const TABS = {
  academic: { label: 'Academic risk', filter: { academic_risk: 'High,Medium' }, sort: '-academic_risk_prob' },
  placement: { label: 'Placement risk', filter: { placement_risk: 'High,Medium' }, sort: '-placement_risk_prob' },
  sliding: { label: 'Sliding (4-week drop)', filter: { sliding: 'true' }, sort: 'trend_4w' },
} as const

export default function Students({ mode }: { mode: 'all' | 'risk' }) {
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const tab = (params.get('tab') as keyof typeof TABS) || 'academic'
  const f = (k: string) => params.get(k) ?? ''
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v); else p.delete(k)
    if (k !== 'page') p.delete('page')
    setParams(p, { replace: true })
  }
  const [q, setQ] = useState(f('q'))
  useEffect(() => { const t = setTimeout(() => q !== f('q') && set('q', q), 300); return () => clearTimeout(t) }, [q]) // eslint-disable-line
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const activeFilters = ['dept', 'year', 'band', 'segment', 'academic_risk', 'placement_risk', 'sliding', 'below_75'].filter((k) => params.get(k)).length

  const sort = f('sort') || (mode === 'risk' ? TABS[tab].sort : '-academic_risk_prob')
  const page = Number(f('page') || 1)
  const query = useMemo(() => qs({
    ...(mode === 'risk' ? TABS[tab].filter : {}),
    dept: f('dept'), year: f('year'), band: f('band'), segment: f('segment'), q: f('q'), below_75: f('below_75'),
    ...(mode === 'all' ? { academic_risk: f('academic_risk'), placement_risk: f('placement_risk'), sliding: f('sliding') } : {}),
    focus: mode === 'risk' && tab !== 'sliding' ? tab : undefined, sort, page, size: 25,
  }), [params, mode]) // eslint-disable-line
  const { data, error, loading, reload } = useApi(`/students?${query}`)

  const SortHead = ({ k, children, wide }: { k: string; children: string; wide?: boolean }) => {
    const active = sort.replace('-', '') === k
    const desc = sort.startsWith('-')
    return (
      <th className={`py-2 pr-3 font-medium ${wide ? 'hidden 2xl:table-cell' : ''}`}>
        <button className="inline-flex items-center gap-0.5 hover:text-ink" onClick={() => set('sort', active && desc ? k : `-${k}`)}>
          {children}{active && (desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
        </button>
      </th>
    )
  }
  const items: any[] = data?.items ?? []
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div>
      <PageHeader title={mode === 'risk' ? 'At-Risk Students' : 'All Students'}
        subtitle={mode === 'risk' ? 'Risk flags combine an ML model (probability) with hard rules (e.g. attendance below 75%). Each flag lists its top drivers.' : 'Unified Student 360 records across all seven sources. Click a student for the full profile.'} />

      {mode === 'risk' && (
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1" role="tablist">
          {(Object.keys(TABS) as (keyof typeof TABS)[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => { const p = new URLSearchParams(); p.set('tab', t); setParams(p) }}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${tab === t ? 'bg-accent text-white' : 'text-ink-2 hover:bg-surface-2'}`}>{TABS[t].label}</button>
          ))}
        </div>
      )}

      <Card>
        <button onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}
          className="mb-3 inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium md:hidden">
          <SlidersHorizontal className="h-4 w-4" /> {showFilters ? 'Hide filters' : 'Filters'}{activeFilters > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-white">{activeFilters}</span>}
        </button>
        <div className={`mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7 ${showFilters ? '' : 'max-md:[&>*:not(:first-child)]:hidden'}`}>
          <label className="col-span-2 flex flex-col gap-1 text-xs text-muted sm:col-span-3 lg:col-span-2">
            Search
            <span className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or student ID"
                className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-2 text-sm text-ink" />
            </span>
          </label>
          <Select label="Department" value={f('dept')} onChange={(v) => set('dept', v)} options={['CSE', 'IT', 'ECE', 'ME', 'CE']} />
          <Select label="Year" value={f('year')} onChange={(v) => set('year', v)} options={['1', '2', '3', '4']} />
          <Select label="Band" value={f('band')} onChange={(v) => set('band', v)} options={['Thriving', 'On track', 'Watch', 'At risk']} />
          <Select label="Segment" value={f('segment')} onChange={(v) => set('segment', v)} options={SEGMENTS} />
          {mode === 'all' ? (
            <Select label="Risk flag" value={f('academic_risk') ? `a:${f('academic_risk')}` : f('placement_risk') ? `p:${f('placement_risk')}` : f('sliding') ? 'sliding' : ''}
              onChange={(v) => {
                const p = new URLSearchParams(params)
                ;['academic_risk', 'placement_risk', 'sliding', 'page'].forEach((k) => p.delete(k))
                if (v.startsWith('a:')) p.set('academic_risk', v.slice(2))
                else if (v.startsWith('p:')) p.set('placement_risk', v.slice(2))
                else if (v === 'sliding') p.set('sliding', 'true')
                setParams(p, { replace: true })
              }}
              options={[['a:High', 'Academic: High'], ['a:Medium', 'Academic: Medium'], ['p:High', 'Placement: High'], ['p:Medium', 'Placement: Medium'], ['sliding', 'Sliding']]} />
          ) : <div />}
        </div>

        {f('below_75') && (
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-critical/10 px-3 py-1 text-xs font-medium text-critical-text">
              Term attendance below 75% <button aria-label="Clear filter" onClick={() => set('below_75', '')}><X className="h-3.5 w-3.5" /></button>
            </span>
          </div>
        )}
        {selected.size > 0 && <AssignPanel ids={[...selected]} onDone={() => { setSelected(new Set()); reload() }} />}

        {error ? <ErrorBox error={error} /> : loading && !data ? <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div> : (
          <>
            <div className="mb-2 text-xs text-muted">{data.total.toLocaleString()} students match · <span className="hidden xl:inline">select rows</span><span className="xl:hidden">tick students</span> to assign an intervention in bulk</div>
            {/* Phones / small tablets: tappable cards instead of a wide table */}
            <ul className="grid gap-2 md:grid-cols-2 xl:hidden">
              {items.map((s) => (
                <li key={s.student_id} className={`flex items-stretch gap-2 rounded-xl border border-line ${selected.has(s.student_id) ? 'bg-accent-soft' : 'bg-surface'}`}>
                  <label className="flex items-center pl-3"><input type="checkbox" className="h-5 w-5" aria-label={`Select ${s.name}`} checked={selected.has(s.student_id)} onChange={() => toggle(s.student_id)} /></label>
                  <button onClick={() => nav(`/students/${s.student_id}`)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 text-left">
                    <ScoreRing score={s.success_score} size={46} stroke={5} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5"><span className="truncate font-semibold">{s.name}</span><Trend value={s.trend_4w} /></span>
                      <span className="block text-xs text-muted">{s.student_id} · {s.dept} Y{s.year}{s.section} · CGPA {fmt(s.cgpa, 1)} · Att {fmt(s.attendance_term, 0)}%</span>
                      <span className="mt-1.5 flex flex-wrap gap-1"><BandBadge band={s.band} /><RiskBadge tier={s.academic_risk} label="Acad" /><RiskBadge tier={s.placement_risk} label="Place" /></span>
                      {s.top_driver && <span className="mt-1 block truncate text-xs text-ink-2">Why: {s.top_driver}</span>}
                    </span>
                  </button>
                </li>
              ))}
              {!items.length && <li><Empty icon={<SearchX className="h-5 w-5" />} title="No students match these filters" text="Try removing a filter or searching by a different name or ID." /></li>}
            </ul>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[880px] text-sm tnum 2xl:min-w-[1180px]">
                <thead className="whitespace-nowrap text-left text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="w-8 py-2"><input type="checkbox" aria-label="Select all on page" checked={items.length > 0 && items.every((i) => selected.has(i.student_id))}
                      onChange={(e) => setSelected((s) => { const n = new Set(s); items.forEach((i) => e.target.checked ? n.add(i.student_id) : n.delete(i.student_id)); return n })} /></th>
                    <SortHead k="name">Student</SortHead>
                    <th className="py-2 pr-3 font-medium">Dept · Yr</th>
                    <SortHead k="success_score">Success Score</SortHead>
                    <SortHead k="trend_4w">4-wk trend</SortHead>
                    <SortHead k="academic_risk_prob">Academic risk</SortHead>
                    <SortHead k="placement_risk_prob">Placement risk</SortHead>
                    <th className="py-2 pr-3 font-medium">Top driver</th>
                    <th className="hidden py-2 pr-3 font-medium 2xl:table-cell">Segment</th>
                    <SortHead k="attendance_term" wide>Attend.</SortHead>
                    <SortHead k="cgpa" wide>CGPA</SortHead>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.student_id} className={`border-b border-line last:border-0 hover:bg-surface-2 ${selected.has(s.student_id) ? 'bg-accent-soft' : ''}`}>
                      <td className="py-2"><input type="checkbox" aria-label={`Select ${s.name}`} checked={selected.has(s.student_id)} onChange={() => toggle(s.student_id)} /></td>
                      <td className="py-2 pr-3">
                        <button onClick={() => nav(`/students/${s.student_id}`)} className="flex items-center gap-2.5 text-left">
                          <Avatar name={s.name} band={s.band} size={32} />
                          <span>
                            <span className="block whitespace-nowrap font-medium text-ink hover:text-accent-ink hover:underline">{s.name}</span>
                            <span className="block text-xs text-muted">{s.student_id}</span>
                          </span>
                        </button>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-ink-2">{s.dept} · {s.year}{s.section}</td>
                      <td className="py-2 pr-3"><div className="flex items-center gap-2"><ScoreRing score={s.success_score} size={36} stroke={4} /><BandBadge band={s.band} /></div></td>
                      <td className="py-2 pr-3"><Trend value={s.trend_4w} /></td>
                      <td className="py-2 pr-3"><div className="flex items-center gap-1.5"><RiskBadge tier={s.academic_risk} /><span className="text-xs text-muted">{pct(s.academic_risk_prob)}</span></div></td>
                      <td className="py-2 pr-3"><div className="flex items-center gap-1.5"><RiskBadge tier={s.placement_risk} /><span className="text-xs text-muted">{pct(s.placement_risk_prob)}</span></div></td>
                      <td className="max-w-[200px] truncate py-2 pr-3 text-xs text-ink-2" title={s.top_driver ?? ''}>{s.top_driver ?? '–'}</td>
                      <td className="hidden max-w-[160px] truncate py-2 pr-3 text-xs text-ink-2 2xl:table-cell" title={s.segment}>{s.segment}</td>
                      <td className={`hidden py-2 pr-3 2xl:table-cell ${s.attendance_term < 75 ? 'font-semibold text-critical-text' : ''}`}>{fmt(s.attendance_term, 0)}%</td>
                      <td className="hidden py-2 pr-3 2xl:table-cell">{fmt(s.cgpa, 2)}</td>
                    </tr>
                  ))}
                  {!items.length && <tr><td colSpan={11}><Empty icon={<SearchX className="h-5 w-5" />} title="No students match these filters" text="Try removing a filter or searching by a different name or ID." /></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 text-sm xl:justify-end">
              <span className="text-muted">Page {page} of {Math.max(1, Math.ceil(data.total / 25))}</span>
              <button aria-label="Previous page" disabled={page <= 1} onClick={() => set('page', String(page - 1))} className="rounded-lg border border-line p-2.5 disabled:opacity-40 xl:p-1.5"><ChevronLeft className="h-4 w-4" /></button>
              <button aria-label="Next page" disabled={page * 25 >= data.total} onClick={() => set('page', String(page + 1))} className="rounded-lg border border-line p-2.5 disabled:opacity-40 xl:p-1.5"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
