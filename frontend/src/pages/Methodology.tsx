import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { Button, Card, DOMAINS, DOMAIN_LABEL, ErrorBox, Loading, PageHeader, useApi } from '../ui'

export default function Methodology() {
  const { data, error, loading, reload } = useApi('/model')
  const { session } = useAuth()
  const [w, setW] = useState<Record<string, number>>({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (data) setW(Object.fromEntries(DOMAINS.map((d) => [d, Math.round(data.weights[d] * 100)]))) }, [data])
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} />
  const sum = Object.values(w).reduce((a, b) => a + b, 0)
  const admin = session!.user.role === 'admin'

  const save = async () => {
    setBusy(true)
    setMsg('')
    try {
      const r = await api('/config/weights', { method: 'PUT', body: { weights: Object.fromEntries(DOMAINS.map((d) => [d, w[d] / 100])) } })
      setMsg(`Saved as version ${r.version}; ${r.summary.students} students re-scored in ${r.summary.seconds}s.`)
      reload()
    } catch (e: any) { setMsg(e.message) } finally { setBusy(false) }
  }
  const m = data.risk.metrics

  return (
    <div>
      <PageHeader title="Student Success Score: Methodology" subtitle="Transparent, weighted, explainable. Every score and risk flag can be traced back to its indicators." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="1 · Domain weights" subtitle={`Version ${data.weights_version}. For Years 1–2, ${Math.round(data.early_year_shift * 100)} pts of the Placement weight move to Academic.`}>
          <ul className="space-y-3">
            {DOMAINS.map((d) => (
              <li key={d}>
                <label className="flex items-center justify-between text-sm"><span>{DOMAIN_LABEL[d]}</span><span className="tnum font-semibold">{w[d]}%</span></label>
                <input type="range" min={0} max={60} step={5} value={w[d] ?? 0} disabled={!admin} onChange={(e) => setW({ ...w, [d]: Number(e.target.value) })} className="w-full" aria-label={`${DOMAIN_LABEL[d]} weight`} />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3">
            <span className={`text-sm tnum ${sum === 100 ? 'text-good-text' : 'text-critical-text'}`}>Total {sum}%</span>
            {admin ? <Button onClick={save} disabled={sum !== 100 || busy}>{busy ? 'Re-scoring…' : 'Save & re-score all students'}</Button> : <span className="text-xs text-muted">Only Admin can change weights.</span>}
          </div>
          {msg && <p className="mt-2 text-sm text-ink-2">{msg}</p>}
        </Card>
        <Card title="2 · How the score is computed">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-2">
            <li>Clean and integrate the 7 sources; impute missing domains from the dept × year cohort median and flag them as low confidence.</li>
            <li>Scale every indicator to 0–100 against a fixed, policy-based range (e.g. attendance 50→95%), inverted where lower is better (backlogs).</li>
            <li>Domain score = mean of its available indicators.</li>
            <li><b className="text-ink">Success Score = Σ weight × domain score</b> (0–100).</li>
            <li>Bands: {data.bands.map((b: any) => `${b.band} ≥ ${b.min}`).join(' · ')}.</li>
            <li>Sliding alert: score dropped ≥ 10 points across the last 4 weekly snapshots.</li>
          </ol>
          <h3 className="mt-4 text-sm font-semibold">3 · Risk flags (separate from the score)</h3>
          <p className="mt-1 text-sm text-ink-2">Two interpretable logistic-regression models predict <b>academic setback</b> and <b>placement unreadiness</b>. Tiers: High ≥ {data.risk.high * 100}%, Medium ≥ {data.risk.medium * 100}%. Hard rules always flag High (attendance &lt; 75% detention rule, ≥ 2 backlogs, final year with coding &lt; 30). Per-student drivers are exact additive contributions (coefficient × standardised value).</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
            {Object.entries(m).map(([k, v]: any) => (
              <div key={k} className="rounded-lg bg-surface-2 p-3"><div className="text-xs text-muted">{k} model (hold-out)</div><div className="mt-1 font-semibold tnum">AUC {v.auc}</div><div className="text-xs text-muted">recall {Math.round(v.recall_high_or_medium * 100)}% · base rate {Math.round(v.base_rate * 100)}%</div></div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="mt-4" title="4 · Indicators used" subtitle={`${data.indicators.length} indicators across 6 domains from 7 sources`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted"><tr className="border-b border-line"><th className="py-2 pr-3 font-medium">Indicator</th><th className="py-2 pr-3 font-medium">Domain</th><th className="py-2 pr-3 font-medium">Source</th><th className="py-2 pr-3 font-medium">Scale range</th><th className="py-2 font-medium">Direction</th></tr></thead>
            <tbody>{data.indicators.map((i: any) => <tr key={i.feature} className="border-b border-line last:border-0"><td className="py-1.5 pr-3">{i.label}</td><td className="py-1.5 pr-3 text-ink-2">{DOMAIN_LABEL[i.domain]}</td><td className="py-1.5 pr-3 text-ink-2">{i.source}</td><td className="py-1.5 pr-3 tnum text-ink-2">{i.lo} → {i.hi}</td><td className="py-1.5 text-ink-2">{i.direction}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
