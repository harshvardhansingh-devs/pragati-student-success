import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { api } from '../api'
import { Button } from '../ui'

const PRESETS = [
  ['Attendance counselling + parent connect', 'Mentor'],
  ['Remedial classes in weak subjects', 'HoD / Subject faculty'],
  ['Weekly LMS check-in & assignment plan', 'Mentor'],
  ['Enrol in DSA / coding bootcamp', 'Placement cell'],
  ['Aptitude training batch', 'Placement cell'],
  ['Schedule 2 mock interviews', 'Placement cell'],
  ['Certification track (NPTEL / industry)', 'Placement cell'],
  ['Communication skills workshop', 'Training cell'],
  ['Wellbeing check-in & club onboarding', 'Counsellor'],
]

export default function AssignPanel({ ids, onDone, preset, reason }: { ids: string[]; onDone: () => void; preset?: [string, string]; reason?: string }) {
  const [action, setAction] = useState(preset?.[0] ?? PRESETS[0][0])
  const [owner, setOwner] = useState(preset?.[1] ?? PRESETS[0][1])
  const [due, setDue] = useState(14)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const submit = async () => {
    setBusy(true)
    try {
      const r = await api('/interventions', { body: { student_ids: ids, action, owner, due_in_days: due, notes: notes || null, reason: reason ?? null } })
      setMsg(`Assigned to ${r.created} student${r.created > 1 ? 's' : ''}.`)
      setTimeout(onDone, 900)
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mb-4 rounded-xl border border-accent/40 bg-accent-soft p-3">
      <div className="mb-2 text-sm font-medium text-accent-ink">Assign intervention to {ids.length} student{ids.length > 1 ? 's' : ''}</div>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_100px]">
        <select value={action} onChange={(e) => { setAction(e.target.value); setOwner(PRESETS.find((p) => p[0] === e.target.value)?.[1] ?? owner) }}
          aria-label="Action" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
          {[...new Set([action, ...PRESETS.map((p) => p[0])])].map((a) => <option key={a}>{a}</option>)}
        </select>
        <input value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner" placeholder="Owner" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" />
        <select value={due} onChange={(e) => setDue(Number(e.target.value))} aria-label="Due in" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
          {[7, 14, 30, 60].map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" aria-label="Notes"
        className="mt-2 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm" />
      <div className="mt-2 flex items-center gap-3">
        <Button onClick={submit} disabled={busy}>Assign</Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        {msg && <span className="inline-flex items-center gap-1 text-sm text-ink-2"><CheckCircle2 className="h-4 w-4 text-good" /> {msg}</span>}
      </div>
    </div>
  )
}
