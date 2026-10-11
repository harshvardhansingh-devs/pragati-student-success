import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Bar, Button, Card, DOMAINS, DOMAIN_LABEL, ErrorBox, PageHeader, PageSkeleton, ScoreRing, fmt, toast, useApi } from '../ui'

export default function Segments() {
  const { data, error, loading } = useApi('/segments')
  const nav = useNavigate()
  const [msg, setMsg] = useState<Record<string, string>>({})
  if (loading && !data) return <PageSkeleton />
  if (error) return <ErrorBox error={error} />

  const assignAll = async (seg: string, playbook: string) => {
    try { await doAssign(seg, playbook) } catch (e: any) { toast(e.message, 'error') }
  }
  const doAssign = async (seg: string, playbook: string) => {
    const ids: string[] = []
    for (let page = 1; ; page++) {
      const r = await api(`/students?segment=${encodeURIComponent(seg)}&size=200&page=${page}`)
      ids.push(...r.items.map((s: any) => s.student_id))
      if (ids.length >= r.total) break
    }
    const r = await api('/interventions', { body: { student_ids: ids, action: playbook, owner: 'Mentor', reason: `Segment playbook: ${seg}`, due_in_days: 30 } })
    setMsg({ ...msg, [seg]: `Playbook assigned to ${r.created} students` })
    toast(`${seg}: playbook assigned to ${r.created} students`)
  }

  return (
    <div>
      <PageHeader title="Student Segments" subtitle={<>K-Means clustering (k = {data.method.k}, silhouette {data.method.silhouette}) on the six domain scores. Clusters are named by matching each centroid to an interpretable profile, and each segment carries a targeted playbook.</>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.segments.map((s: any) => (
          <Card key={s.segment} title={s.segment} subtitle={`${s.students} students · ${s.academic_high + s.placement_high} high-risk flags`} action={<ScoreRing score={s.avg_score} size={44} stroke={5} />}>
            <ul className="space-y-1.5">
              {DOMAINS.map((d) => (
                <li key={d} className="grid grid-cols-[110px_1fr_32px] items-center gap-2 text-xs">
                  <span className="text-ink-2">{DOMAIN_LABEL[d]}</span>
                  <Bar value={s.domains[d]} color={s.domains[d] < 45 ? 'var(--critical)' : 'var(--accent)'} />
                  <span className="tnum text-right">{fmt(s.domains[d], 0)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-lg bg-surface-2 p-2.5 text-sm"><span className="text-xs font-medium text-muted">Playbook: </span>{s.playbook}</div>
            <div className="mt-2 text-xs text-muted">High risk: {s.academic_high} academic · {s.placement_high} placement</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => nav(`/students?segment=${encodeURIComponent(s.segment)}`)}>View students</Button>
              <Button variant="ghost" onClick={() => assignAll(s.segment, s.playbook)} disabled={!s.students}>Assign playbook to all</Button>
            </div>
            {msg[s.segment] && <p className="mt-2 text-xs text-good-text">{msg[s.segment]}</p>}
          </Card>
        ))}
      </div>
    </div>
  )
}
