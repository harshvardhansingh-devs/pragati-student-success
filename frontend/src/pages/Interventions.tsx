import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { BandBadge, Card, ErrorBox, Loading, PageHeader, Select, fmt, useApi } from '../ui'

export default function Interventions() {
  const [status, setStatus] = useState('')
  const { data, error, loading, reload } = useApi(`/interventions${status ? `?status=${status}` : ''}`)
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} />
  const update = async (id: number, s: string) => { await api(`/interventions/${id}`, { method: 'PATCH', body: { status: s } }); reload() }

  return (
    <div>
      <PageHeader title="Interventions" subtitle="Every risk flag becomes a tracked action with an owner and due date, closing the loop from insight to outcome." />
      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3" title="Action tracker" action={<div className="w-40"><Select label="Status" value={status} onChange={setStatus} options={[['open', 'Open'], ['in_progress', 'In progress'], ['done', 'Done']]} /></div>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line"><th className="py-2 pr-3 font-medium">Student</th><th className="py-2 pr-3 font-medium">Action</th><th className="py-2 pr-3 font-medium">Owner</th><th className="py-2 pr-3 font-medium">Due</th><th className="py-2 pr-3 font-medium">Score at start → now</th><th className="py-2 font-medium">Status</th></tr>
              </thead>
              <tbody>
                {data.items.map((i: any) => (
                  <tr key={i.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3"><Link to={`/students/${i.student_id}`} className="font-medium hover:underline">{i.name}</Link><div className="text-xs text-muted">{i.student_id} · {i.dept} Y{i.year}</div></td>
                    <td className="py-2 pr-3">{i.action}<div className="text-xs text-muted">{i.reason}</div></td>
                    <td className="py-2 pr-3 text-ink-2">{i.owner}</td>
                    <td className="py-2 pr-3 text-ink-2 tnum">{i.due_date}</td>
                    <td className="py-2 pr-3 tnum">{fmt(i.score_at_creation, 0)} → {fmt(i.success_score, 0)} {i.band && <BandBadge band={i.band} />}</td>
                    <td className="py-2">
                      <select aria-label="Status" value={i.status} onChange={(e) => update(i.id, e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-sm">
                        <option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {!data.items.length && <tr><td colSpan={6} className="py-10 text-center text-muted">No interventions yet. Assign one from a student profile, the At-Risk list, or a segment.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="By action type">
          <ul className="space-y-2 text-sm">
            {data.by_action.map((a: any) => <li key={a.action} className="flex justify-between gap-2"><span className="text-ink-2">{a.action}</span><span className="tnum shrink-0 font-medium">{a.done}/{a.count} done</span></li>)}
            {!data.by_action.length && <li className="text-muted">Nothing assigned yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  )
}
