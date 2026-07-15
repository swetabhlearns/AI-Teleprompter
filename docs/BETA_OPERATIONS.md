# Beta Operations Runbook

Last reviewed: 2026-07-16

## Ownership and alerts

- Operational owner: GitHub repository owner (`@swetabhlearns`).
- The `Beta health monitor` GitHub Action checks Worker readiness twice per hour.
- A failed check opens or updates one GitHub incident issue. Recovery closes the open incident automatically.
- Treat `/ready` failure, repeated HTTP 5xx responses, or a client-error spike as an incident.
- Initial thresholds: investigate any readiness failure immediately; investigate 5 or more identical client errors in 15 minutes; investigate a 5xx rate above 2% over 15 minutes.

## Retention and deletion

- Operational events: 30 days.
- Optional beta feedback: 180 days.
- Interview archives: 365 days.
- The Worker cron runs daily at 02:17 UTC and deletes expired records.
- The Privacy & data page provides capability-scoped deletion for server-side data. It removes interview archives, related D1 live-session rows, feedback, and operational events for the current anonymous browser identity.
- Active Durable Object state expires through the existing session lifecycle. If a user has cleared their browser capability before requesting deletion, the old capability cannot be reconstructed; escalate only if they retained the capability values and can prove control of them.

## D1 recovery drill

Cloudflare D1 Time Travel is the primary recovery path. Before a risky migration, also export an operator-held snapshot outside the repository:

```bash
cd worker
npx wrangler d1 time-travel info ai-tracker-db --remote
npx wrangler d1 export ai-tracker-db --remote --output /tmp/ai-tracker-beta-backup.sql
```

Validate an export without touching production:

```bash
cd worker
rm -f /tmp/ai-tracker-restore.sqlite3
sqlite3 /tmp/ai-tracker-restore.sqlite3 < /tmp/ai-tracker-beta-backup.sql
sqlite3 /tmp/ai-tracker-restore.sqlite3 "PRAGMA integrity_check; SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

For an actual incident, first record the current Time Travel bookmark, identify the last known-good timestamp/bookmark, and follow the current Cloudflare D1 Time Travel restore procedure. Never test a restore against production.

## Rollback

Worker:

```bash
cd worker
npx wrangler versions list
npx wrangler rollback
curl --fail --silent --show-error https://ai-tracker-worker.nick900684.workers.dev/ready
```

Frontend: use the Vercel deployment dashboard to promote the most recent known-good deployment. Then verify `/`, `/script`, `/interview`, `/extempore`, `/history`, and `/privacy` directly.

Database migrations are forward-only. Do not rewrite an applied migration. Prefer a corrective migration; use Time Travel only for a genuine data-loss or corruption incident.

## Release checklist

1. Apply pending D1 migrations before deploying dependent Worker code.
2. Run `npm run check` and a Worker dry run.
3. Deploy the Worker and verify `/ready` plus `/api`.
4. Push the frontend and wait for the Vercel check to succeed.
5. Test direct links, mobile navigation, anonymous deletion, feedback, and one real microphone flow.
6. Confirm no new Worker incident issue or browser console error appears.
