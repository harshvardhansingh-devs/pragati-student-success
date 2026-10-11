import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Send, User } from 'lucide-react'
import { api } from '../api'
import { Button, Card, PageHeader } from '../ui'

const SUGGESTIONS = [
  'Which department has the most sliding students?',
  '3rd-year CSE students with CGPA above 8 but coding below 40',
  'Compare average success score and placement risk by segment',
  'Year 4 students with High placement risk and zero mock interviews',
]
type Msg = { role: 'user' | 'ai'; text: string; table?: any[]; tools?: string[] }

export default function Copilot() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const ask = async (question: string, e?: FormEvent) => {
    e?.preventDefault()
    if (!question.trim()) return
    setMsgs((m) => [...m, { role: 'user', text: question }])
    setQ('')
    setBusy(true)
    try {
      const r = await api('/copilot/query', { body: { question } })
      setMsgs((m) => [...m, { role: 'ai', text: r.answer, table: r.table, tools: r.tools_used }])
    } catch (err: any) {
      setMsgs((m) => [...m, { role: 'ai', text: `Error: ${err.message}` }])
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="AI Copilot" subtitle="Ask questions about your students in plain English. The AI uses read-only analytics tools within your role's scope, and sees IDs and numbers only, never names." />
      <Card>
        <div className="min-h-[300px] space-y-4">
          {!msgs.length && (
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-xl border border-line bg-surface-2 p-3 text-left text-sm hover:border-accent">{s}</button>)}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className="flex gap-3">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${m.role === 'ai' ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2'}`}>{m.role === 'ai' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
                {m.table && m.table.length > 0 && (
                  <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
                    <table className="w-full text-xs tnum">
                      <thead className="sticky top-0 bg-surface-2 text-left text-muted"><tr>{Object.keys(m.table[0]).map((k) => <th key={k} className="px-2 py-1.5 font-medium">{k.replace(/_/g, ' ')}</th>)}</tr></thead>
                      <tbody>{m.table.map((r, j) => <tr key={j} className="border-t border-line">{Object.entries(r).map(([k, v]: any) => <td key={k} className="px-2 py-1.5">{k === 'student_id' ? <Link className="text-accent-ink hover:underline" to={`/students/${v}`}>{v}</Link> : typeof v === 'number' ? Math.round(v * 100) / 100 : String(v ?? '–')}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                )}
                {m.tools && m.tools.length > 0 && <p className="mt-1 text-[11px] text-muted">Tools used: {[...new Set(m.tools)].join(', ')}</p>}
              </div>
            </div>
          ))}
          {busy && <p className="text-sm text-muted">Thinking…</p>}
        </div>
        <form onSubmit={(e) => ask(q, e)} className="mt-4 flex gap-2 border-t border-line pt-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about students, risks, segments, trends…" aria-label="Question" maxLength={500}
            className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-sm" />
          <Button type="submit" disabled={busy || q.trim().length < 3}><Send className="h-4 w-4" /> Ask</Button>
        </form>
      </Card>
    </div>
  )
}
