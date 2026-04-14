import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from './contexts/SessionContext'
import { queryClient } from './app/queryClient'
import '@knadh/oat/oat.min.css'
import '@knadh/oat/js/index.js'
import './index.css'
import App from './App.jsx'

posthog.init(import.meta.env.VITE_POSTHOG_KEY || 'dummy_key', {
  api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  capture_pageview: false
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <App />
          <SpeedInsights />
        </SessionProvider>
      </QueryClientProvider>
    </PostHogProvider>
  </StrictMode>,
)
