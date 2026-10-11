import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

try {
  const t = localStorage.getItem('prajna.theme')
  if (t) document.documentElement.dataset.theme = t
} catch { /* storage blocked */ }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
