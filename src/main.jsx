import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import O3bSimulator from './mpower_simulator.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <O3bSimulator />
  </StrictMode>
)
