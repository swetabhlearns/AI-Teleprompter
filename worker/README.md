# AI Tracker Worker

The Cloudflare Worker is the backend for AI Tracker. It keeps provider credentials out of the browser, proxies generation and speech requests, owns active Gemini Live interviews in a Durable Object, and stores completed interview archives in D1.

See the repository-level `README.md` for the complete application setup and deployment sequence.

## Routes

- `GET /health`
- `GET /ready`
- `GET /api`
- `POST /api/script/generate`
- `POST /api/script/refine`
- `POST /api/extempore/topics`
- `POST /api/extempore/coach`
- `POST /api/transcribe`
- `POST /api/tts/sarvam`
- `POST /api/tts/elevenlabs/:voiceId?`
- `POST /api/feedback`
- `POST /api/events`
- `DELETE /api/data`
- `GET|POST /api/interview/sessions`
- `GET|PATCH|DELETE /api/interview/sessions/:id`
- `POST /api/interview/live-sessions`
- `GET /api/interview/live-sessions/:id`
- `GET /api/interview/live-sessions/:id/log`
- `POST /api/interview/live-sessions/:id/complete`
- `POST /api/interview/live-sessions/:id/fail`
- `GET /api/interview/live-sessions/:id/ws`

## Local development

From the repository root:

```bash
cp worker/.dev.vars.example worker/.dev.vars
cd worker
npx wrangler d1 migrations apply DB --local
npm run dev
```

The default local URL is `http://localhost:8787`. Point the frontend's `VITE_API_BASE_URL` to that URL.

## Configuration

Wrangler expects these bindings:

- `DB`: D1 database
- `INTERVIEW_LIVE_SESSION`: Durable Object namespace

Local provider credentials belong in `.dev.vars`. Production credentials must be set with `npx wrangler secret put <NAME>`.

The default Gemini Live model is pinned by `GEMINI_LIVE_MODEL` in `wrangler.toml`.

The Worker runs its retention job daily at 02:17 UTC. See `docs/BETA_OPERATIONS.md` for retention, deletion, monitoring, recovery, and rollback procedures.

## Migrations

Apply local migrations:

```bash
npx wrangler d1 migrations apply DB --local
```

Apply production migrations before deploying dependent code:

```bash
npx wrangler d1 migrations apply DB --remote
```

Add new numbered SQL files for schema changes; do not alter migrations that have already been applied.

## Deployment

```bash
npm run deploy
```

The `deploy:staging` script is reserved for a future staging environment. It is not usable until `[env.staging]` and a staging D1 binding are added to `wrangler.toml`.

## Verification

Static syntax check:

```bash
npm run check
```

After starting or deploying the Worker, request `/health` and `/api`. Provider-backed routes require valid secrets and should be covered by a deliberate integration smoke test.
