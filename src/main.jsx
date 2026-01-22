import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import './index.css'
import App from './App.jsx'

posthog.init(import.meta.env.VITE_POSTHOG_KEY || 'dummy_key', {
  api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  capture_pageview: false
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </StrictMode>,
)
