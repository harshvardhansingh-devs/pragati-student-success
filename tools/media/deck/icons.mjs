// Run from the frontend dir so it resolves the app's own react + lucide-react.
import { createRequire } from 'module'
const require = createRequire(process.cwd() + '/package.json')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const L = require('lucide-react')
const names = ['Database','CalendarX','BookOpen','Laptop','Target','Trophy','Brain','MessageSquare','AlertTriangle','Clock','Unlink','Gauge',
  'ShieldAlert','Lightbulb','Zap','Users','Building2','UserCheck','Briefcase','GraduationCap','Smartphone','Lock','Scale','Server',
  'Sparkles','TrendingDown','Layers','Bot','CheckCircle2','Merge','Activity','ListChecks','Eye','Rocket','Github','Globe','KeyRound','Boxes']
const out = {}
for (const n of names) {
  const C = L[n]; if (!C) { console.error('missing icon', n); continue }
  out[n] = renderToStaticMarkup(React.createElement(C, { size: 256, color: '#FFFFFF', strokeWidth: 2 }))
}
console.log(JSON.stringify(out))
