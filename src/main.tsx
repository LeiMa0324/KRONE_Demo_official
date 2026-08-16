import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted variable Inter. Subsets are unicode-range gated, so only latin ships.
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
