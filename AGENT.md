# AGENT.md

Guidance for agents working in this repository.

## Scope

- This is a Vite + React application in the repo root.
- There is a separate Cloudflare Worker project in [`worker/`](worker/).
- Treat existing user changes as intentional. Do not revert, overwrite, or "clean up" unrelated modifications.

## Working Rules

- Prefer small, targeted edits over broad refactors.
- Use `apply_patch` for file edits.
- Keep changes ASCII unless a file already uses Unicode or the task requires it.
- Before changing code, inspect the surrounding implementation and follow existing patterns.
- If the repo is already dirty, work around unrelated changes rather than resetting them.
- Do not delete or rewrite untracked files you did not create unless the user asks.

## Commands

Root app:

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run lint`

Worker project:

- `cd worker && npm run dev`
- `cd worker && npm run deploy`
- `cd worker && npm run deploy:staging`
- `cd worker && npm run logs`

## Code Style

- The codebase uses ESM.
- The app is React 19 with Vite, Zustand, TanStack Router, Tailwind CSS v4, Framer Motion, and related browser APIs.
- Prefer functional components and hooks.
- Match existing naming, folder structure, and state patterns before introducing new abstractions.
- Keep UI changes consistent with the current design language unless the task explicitly asks for a redesign.
- Avoid unnecessary memoization or premature optimization.

## Testing

- Add or update tests alongside behavioral changes when practical.
- The existing test runner is `node --test`.
- Prefer focused tests that cover the changed behavior instead of large integration rewrites.

## Environment And Secrets

- Do not commit secrets or local environment values.
- Use [`/.env.example`](.env.example) as the reference for required environment variables.
- If a change depends on missing config, call that out explicitly.

## When In Doubt

- Verify before assuming.
- Ask before making cross-cutting changes, deleting code, or changing architecture.
- For anything time-sensitive or external, confirm the current state rather than relying on memory.
