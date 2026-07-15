# AI Tracker

AI Tracker is a browser-based speaking practice application. It combines AI-assisted script preparation, a teleprompter, timed extempore practice, and live MBA interview simulations with archived analysis.

The repository contains two applications:

- The React frontend in the repository root.
- A Cloudflare Worker in `worker/` that owns provider credentials, AI proxy routes, Gemini Live sessions, and interview persistence.

## Product areas

### Script and teleprompter

Generate or refine a delivery-ready script, control visible speaking notation, save drafts in the browser, and rehearse in a focused scrolling teleprompter.

### Live interview

Configure an MBA admissions interview using school, format, duration, and candidate context. The Worker owns the Gemini Live connection through a Durable Object, persists the completed archive in D1, and performs final analysis.

### Extempore

Generate a filtered set of topics, select one through the rolling topic picker, and complete a two-minute timed speaking round. The current live round is timer-only; it does not record or analyze audio.

## Architecture

```text
Browser (React + Vite)
  |-- HTTP: generation, transcription, TTS, archives
  |-- WebSocket: live interview audio and events
  v
Cloudflare Worker
  |-- Groq: text generation and transcription
  |-- Sarvam / ElevenLabs: text to speech
  |-- Durable Object: active Gemini Live interview
  |-- Gemini: live conversation and final analysis
  `-- D1: completed interview archives
```

Key frontend technologies are React 19, TanStack Router, TanStack Query, Zustand, Tailwind CSS 4, and Framer Motion. The Worker uses Cloudflare D1 and Durable Objects.

## Requirements

- Node.js 20 or newer
- npm
- A Cloudflare account for Worker development and deployment
- Provider credentials for the features being exercised

## Local setup

Install frontend dependencies:

```bash
npm install
```

Create the frontend environment file:

```bash
cp .env.example .env.local
```

For a local Worker, set `VITE_API_BASE_URL=http://localhost:8787` in `.env.local`. The example file points to the currently configured production Worker.

Create local Worker secrets:

```bash
cp worker/.dev.vars.example worker/.dev.vars
```

Fill in only the provider keys needed for the flows you intend to run. Never commit `.env.local` or `worker/.dev.vars`.

Apply D1 migrations and start the Worker:

```bash
cd worker
npx wrangler d1 migrations apply DB --local
npx wrangler dev
```

In another terminal, start the frontend:

```bash
npm run dev
```

Vite prints the local frontend URL. The application header reports whether the configured Worker is healthy.

## Environment variables

### Frontend

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Yes for AI features | Base URL of the Cloudflare Worker |

Provider keys must not be exposed through `VITE_*` variables.

### Worker secrets

| Secret | Feature |
| --- | --- |
| `GROQ_API_KEY` | Script generation, topic generation, coaching, transcription |
| `GEMINI_API_KEY` | Live interview and final interview analysis |
| `SARVAM_API_KEY` | Sarvam text to speech |
| `ELEVENLABS_API_KEY` | ElevenLabs text to speech fallback |

`GEMINI_LIVE_MODEL` is a non-secret Worker variable and is currently pinned in `worker/wrangler.toml`.

## Verification

Run the complete local verification suite:

```bash
npm run check
```

Or run checks independently:

```bash
npm test
npm run lint
npm run build
npm run check:worker
```

Tests use Node's built-in test runner. Worker behavior with external providers still requires integration testing against a configured local or deployed Worker.

## Database migrations

D1 migrations live in `worker/migrations/`. Apply them locally before Worker development:

```bash
cd worker
npx wrangler d1 migrations apply DB --local
```

Apply them to production before deploying Worker code that relies on a new schema:

```bash
cd worker
npx wrangler d1 migrations apply DB --remote
```

Do not rewrite an applied migration. Add a new numbered migration instead.

## Deployment

The Worker deployment is the stateful part of the system. From `worker/`:

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put SARVAM_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

After deployment, verify:

```bash
curl https://YOUR_WORKER_DOMAIN/health
curl https://YOUR_WORKER_DOMAIN/api
```

Then build the frontend with `VITE_API_BASE_URL` pointing to that Worker and deploy the generated `dist/` directory to the frontend host.

The repository currently defines a `deploy:staging` npm script, but `worker/wrangler.toml` does not yet define a staging environment or staging D1 database. Do not use that command until those bindings are configured.

## Current limitations

- There is no user authentication or per-user archive ownership.
- Worker CORS currently permits every origin.
- Extempore live practice is timed but does not capture audio.
- Interview archives are shared at the configured database level because user accounts do not yet exist.
- The production frontend bundle currently triggers Vite's large-chunk warning.

These limitations should be addressed before a public beta.
