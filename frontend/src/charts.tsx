import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'

/** Read design tokens at render time so charts follow light/dark mode. */
function useTokens() {
  const read = () => {
    const cs = getComputedStyle(document.documentElement)
    const v = (n: string) => cs.getPropertyValue(n).trim()
    return {
      ink: v('--ink'), ink2: v('--ink-2'), muted: v('--muted'), grid: v('--grid'), axis: v('--axis'), surface: v('--surface'),
      series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--s${i}`)), good: v('--good'), warn: v('--warn'), critical: v('--critical'),
      accent: v('--accent'), seqLo: v('--seq-lo'), seqHi: v('--seq-hi'),
    }
  }
  const [t, setT] = useState(read)
  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setT(read())
    m.addEventListener('change', on)
    const obs = new MutationObserver(on)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { m.removeEventListener('change', on); obs.disconnect() }
  }, [])
  return t
}
export type Tokens = ReturnType<typeof useTokens>

const base = (t: Tokens) => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: t.ink2 },
  tooltip: {
    backgroundColor: t.surface, borderColor: t.grid, borderWidth: 1, textStyle: { color: t.ink, fontSize: 12 },
    extraCssText: 'border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);',
  },
  animationDuration: 400,
})
const axis = (t: Tokens) => ({
  axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false },
  axisLabel: { color: t.muted, fontSize: 11 }, splitLine: { lineStyle: { color: t.grid, width: 1 } },
})

export function Chart({ option, height = 280, label }: { option: (t: Tokens) => object; height?: number; label: string }) {
  const t = useTokens()
  return (
    <div role="img" aria-label={label}>
      <ReactECharts option={{ ...base(t), ...option(t) }} style={{ height }} notMerge opts={{ renderer: 'svg' }} />
    </div>
  )
}

/** Multi-series line chart over weeks with crosshair tooltip. */
export function LineChart({ x, series, height = 280, label, yMin, colors }: { x: (string | number)[]; series: { name: string; data: (number | null)[]; dashed?: boolean; color?: string }[]; height?: number; label: string; yMin?: number; colors?: string[] }) {
  return (
    <Chart label={label} height={height} option={(t) => ({
      color: colors ?? t.series,
      legend: series.length > 1 ? { top: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 12 } } : undefined,
      grid: { left: 36, right: 16, top: series.length > 1 ? 36 : 12, bottom: 28 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.axis } }, valueFormatter: (v: number) => (v == null ? '–' : v.toFixed(1)) },
      xAxis: { type: 'category', data: x, boundaryGap: false, ...axis(t), splitLine: { show: false } },
      yAxis: { type: 'value', min: yMin, scale: yMin === undefined, ...axis(t), axisLine: { show: false } },
      series: series.map((s) => ({
        name: s.name, type: 'line', data: s.data, smooth: false, showSymbol: false, symbolSize: 8,
        lineStyle: { width: 2, type: s.dashed ? 'dashed' : 'solid', ...(s.color ? { color: s.color } : {}) },
        ...(s.color ? { itemStyle: { color: s.color } } : {}),
        emphasis: { focus: 'series' },
      })),
    })} />
  )
}

/** Horizontal stacked bar (e.g. bands per department). */
export function StackedBar({ categories, stacks, height = 260, label }: { categories: string[]; stacks: { name: string; data: number[]; color: string }[]; height?: number; label: string }) {
  return (
    <Chart label={label} height={height} option={(t) => ({
      legend: { top: 0, type: 'scroll', icon: 'roundRect', itemWidth: 10, itemHeight: 10, itemGap: 12, textStyle: { color: t.ink2, fontSize: 12 } },
      grid: { left: 44, right: 16, top: 34, bottom: 24 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', ...axis(t) },
      yAxis: { type: 'category', data: categories, ...axis(t), axisLabel: { color: t.ink2, fontSize: 12 } },
      series: stacks.map((s, i) => ({
        name: s.name, type: 'bar', stack: 'a', data: s.data, barWidth: 16,
        itemStyle: { color: s.color, borderColor: t.surface, borderWidth: 1, borderRadius: i === stacks.length - 1 ? [0, 4, 4, 0] : 0 },
      })),
    })} />
  )
}

/** Department × year heatmap of a 0-100 metric (sequential, one hue). */
export function Heatmap({ rows, cols, cells, height = 240, label }: { rows: string[]; cols: string[]; cells: [number, number, number][]; height?: number; label: string }) {
  return (
    <Chart label={label} height={height} option={(t) => ({
      grid: { left: 48, right: 12, top: 8, bottom: 52 },
      tooltip: { formatter: (p: any) => `${rows[p.value[1]]} · ${cols[p.value[0]]}<br/><b>${p.value[2]}</b> avg Success Score` },
      xAxis: { type: 'category', data: cols, ...axis(t), splitArea: { show: false } },
      yAxis: { type: 'category', data: rows, ...axis(t), axisLabel: { color: t.ink2, fontSize: 12 } },
      visualMap: { min: 40, max: 70, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 140, itemWidth: 10,
        inRange: { color: [t.seqLo, t.seqHi] }, textStyle: { color: t.muted, fontSize: 11 } },
      series: [{ type: 'heatmap', data: cells, label: { show: true, color: 'inherit', fontSize: 12, formatter: (p: any) => p.value[2].toFixed(0) },
        itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 4 }, emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 1 } } }],
    })} />
  )
}

/** Radar: student vs cohort across the six domains. */
export function Radar({ indicators, series, height = 280, label }: { indicators: string[]; series: { name: string; data: number[] }[]; height?: number; label: string }) {
  return (
    <Chart label={label} height={height} option={(t) => ({
      color: [t.series[0], t.muted],
      legend: { bottom: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 12 } },
      tooltip: { trigger: 'item' },
      radar: { indicator: indicators.map((n) => ({ name: n, max: 100 })), radius: '62%', center: ['50%', '47%'],
        axisName: { color: t.ink2, fontSize: 11 }, splitLine: { lineStyle: { color: t.grid } }, splitArea: { show: false }, axisLine: { lineStyle: { color: t.grid } } },
      series: [{ type: 'radar', symbolSize: 6, data: series.map((s, i) => ({ name: s.name, value: s.data.map((v) => Math.round(v)),
        lineStyle: { width: 2, type: i ? 'dashed' : 'solid' }, areaStyle: i ? undefined : { opacity: 0.12 } })) }],
    })} />
  )
}

/** Diverging horizontal bars: contribution vs cohort (blue above, red below). */
export function Diverging({ labels, values, height, label, unit = 'pts' }: { labels: string[]; values: number[]; height?: number; label: string; unit?: string }) {
  return (
    <Chart label={label} height={height ?? Math.max(160, labels.length * 26 + 30)} option={(t) => ({
      grid: { left: 170, right: 40, top: 6, bottom: 20 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)} ${unit} vs cohort` },
      xAxis: { type: 'value', ...axis(t) },
      yAxis: { type: 'category', data: labels, inverse: true, ...axis(t), axisLabel: { color: t.ink2, fontSize: 11, width: 160, overflow: 'truncate' } },
      series: [{ type: 'bar', barWidth: 12, data: values.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? t.series[0] : t.critical, borderRadius: v >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })),
        label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: (p: any) => `${p.value > 0 ? '+' : ''}${p.value.toFixed(1)}` } }],
    })} />
  )
}
