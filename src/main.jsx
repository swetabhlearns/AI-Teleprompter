import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from './contexts/SessionContext'
import { queryClient } from './app/queryClient'
import '@knadh/oat/oat.min.css'
import '@knadh/oat/js/index.js'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <App />
        <SpeedInsights />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
