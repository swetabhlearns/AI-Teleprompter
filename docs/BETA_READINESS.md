# AI Teleprompter Beta Readiness

Last reviewed: 2026-07-16

## Product experience

- [x] Account-free onboarding and practice goals
- [x] Script, Interview, and Extempore primary flows
- [x] Browser-local activity history and recommendations
- [x] Practice streaks, mode trends, and drill follow-through
- [x] Anonymous feedback with offline retry
- [x] Plain-language beta data notice

## Reliability and operations

- [x] Cloudflare Worker readiness probe includes D1
- [x] Allowlisted product telemetry and sanitized client error classes
- [x] Worker request bounds, capability protection, CORS, and route-specific rate limits
- [x] Worker logs and observability enabled
- [x] Vercel SPA fallback and route-level recovery UI
- [ ] Define alert thresholds and an operational owner for Worker errors
- [ ] Establish an automated D1 backup and restore drill

## Privacy and governance

- [x] Telemetry excludes user-generated content
- [x] Feedback UI discloses exactly what is submitted
- [x] Anonymous browser capability scopes stored records
- [ ] Define retention periods for interview archives, feedback, and operational events
- [ ] Provide a support-assisted deletion process before broad public access
- [ ] Replace the beta data notice with reviewed legal privacy and terms documents

## Release verification

- [x] Automated test, lint, frontend build, and Worker syntax checks
- [x] Mobile and desktop responsive smoke tests
- [x] Direct-link Vercel route verification
- [ ] Complete real microphone sessions on current Chrome, Safari, iOS, and Android
- [ ] Assign and verify a stable production domain
- [ ] Confirm Production and Preview environment variables independently
- [ ] Merge `changes/cloudflare` through a reviewed pull request
- [ ] Tag the first beta release
