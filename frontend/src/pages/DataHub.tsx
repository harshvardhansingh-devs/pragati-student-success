import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Database, Scale, Upload } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../App'
import { Button, Card, ErrorBox, Loading, PageHeader, fmt, useApi } from '../ui'

export default function DataHub() {
  const { data, error, loading, reload } = useApi('/data-quality')
  const fair = useApi('/fairness')
  const { session } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState('attendance')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} />
  const src = data.sources
  const total = (k: string) => src.reduce((a: number, s: any) => a + (s[k] || 0), 0)

  const upload = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) return
    const form = new FormData()
    form.append('source', source)
    form.append('file', file)
    setBusy(true)
    setMsg('')
    try {
      const r = await api('/ingest/upload', { form })
      setMsg(`Loaded ${r.rows.toLocaleString()} rows; all scores recomputed in ${r.summary.seconds}s.`)
      reload()
    } catch (err: any) { setMsg(err.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader title="Data Integration & Quality" subtitle={`${src.length} source systems unified into one Student 360 record per student · last pipeline run #${data.run.run_id} at ${new Date(data.run.finished_at).toLocaleString()} (${data.run.seconds}s)`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[['Raw rows ingested', total('rows_in')], ['Duplicates removed', total('duplicates_removed')], ['IDs reconciled', total('ids_normalized')],
          ['Values repaired', total('values_fixed')], ['Bad values quarantined', total('quarantined') + total('unmatched_ids')]].map(([l, v]) => (
          <div key={l as string} className="card p-4"><div className="text-xs text-ink-2">{l}</div><div className="mt-1 text-2xl font-semibold tnum">{(v as number).toLocaleString()}</div></div>
        ))}
      </div>

      <Card className="mt-4" title="Pipeline" subtitle="Each run is idempotent: raw data is never modified, and everything downstream is recomputed">
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {data.steps.map((s: string, i: number) => (
            <li key={s} className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-good" /> {s}</span>
              {i < data.steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted" />}
            </li>
          ))}
        </ol>
      </Card>

      <Card className="mt-4" title={<span className="inline-flex items-center gap-1.5"><Database className="h-4 w-4" /> Source quality report</span>}
        subtitle="ID reconciliation maps each system's key (student ID variants, roll numbers, LMS emails) to one canonical student ID">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm tnum">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">{['Source', 'Rows in', 'Duplicates', 'IDs reconciled', 'Unmatched IDs', 'Values repaired', 'Quarantined', 'Clean rows', 'Student coverage', 'Completeness'].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {src.map((s: any) => (
                <tr key={s.source} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3"><div className="font-medium">{s.label}</div><div className="text-xs text-muted">{s.source}</div></td>
                  <td className="py-2 pr-3">{s.rows_in.toLocaleString()}</td><td className="py-2 pr-3">{s.duplicates_removed}</td><td className="py-2 pr-3">{s.ids_normalized.toLocaleString()}</td>
                  <td className="py-2 pr-3">{s.unmatched_ids}</td><td className="py-2 pr-3">{s.values_fixed}</td><td className="py-2 pr-3">{s.quarantined}</td>
                  <td className="py-2 pr-3">{Number(s.rows_clean).toLocaleString()}</td><td className="py-2 pr-3">{fmt(s.students_covered)}%</td><td className="py-2">{fmt(s.completeness)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Coverage below 100% is expected where a source doesn't apply to everyone (e.g. placement assessments start in Year 3, and not every student joins clubs). Missing domains are imputed from the cohort median and flagged as low confidence.</p>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={<span className="inline-flex items-center gap-1.5"><Upload className="h-4 w-4" /> Upload a source file</span>} subtitle="Replace a source with a new CSV export. The whole pipeline re-runs and scores update for every user.">
          {session!.user.role === 'admin' ? (
            <form onSubmit={upload} className="space-y-3">
              <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source" className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm">
                {src.map((s: any) => <option key={s.source} value={s.source}>{s.label}</option>)}
              </select>
              <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="CSV file" className="block w-full text-sm" />
              <Button type="submit" disabled={!file || busy}>{busy ? 'Processing…' : 'Upload & recompute'}</Button>
              {msg && <p className="text-sm text-ink-2">{msg}</p>}
              <p className="text-xs text-muted">Sample files: <code>data/raw/*.csv</code> in the repository. Columns must match the source's schema; on failure the previous data is restored.</p>
            </form>
          ) : <p className="text-sm text-ink-2">Only the Admin role can upload data.</p>}
        </Card>
        <Card title={<span className="inline-flex items-center gap-1.5"><Scale className="h-4 w-4" /> Fairness check</span>} subtitle="Gender and admission category are never model inputs. We monitor flag-rate parity (four-fifths rule).">
          {fair.data ? Object.entries(fair.data).map(([g, v]: any) => (
            <div key={g} className="mb-3">
              <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium">{g === 'gender' ? 'Gender' : 'Admission category'}</span>
                <span className={`text-xs font-medium ${v.passes_four_fifths ? 'text-good-text' : 'text-warn-text'}`}>{v.passes_four_fifths ? '✓ Passes' : '⚠ Review'} · parity {fmt(v.parity_ratio.academic_high, 2)} / {fmt(v.parity_ratio.placement_high, 2)}</span></div>
              <table className="w-full text-xs tnum"><thead className="text-muted"><tr><th className="text-left font-medium">Group</th><th className="text-right font-medium">Students</th><th className="text-right font-medium">Avg score</th><th className="text-right font-medium">% High acad.</th><th className="text-right font-medium">% High place.</th></tr></thead>
                <tbody>{v.groups.map((r: any) => <tr key={r[g]}><td>{r[g]}</td><td className="text-right">{r.students}</td><td className="text-right">{fmt(r.avg_score)}</td><td className="text-right">{fmt(r.academic_high)}</td><td className="text-right">{fmt(r.placement_high)}</td></tr>)}</tbody></table>
            </div>
          )) : <Loading />}
        </Card>
      </div>
    </div>
  )
}
