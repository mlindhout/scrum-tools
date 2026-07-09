# Scrum Tools

Accountless planning poker & retrospectives. Create a Room, share the link,
join with a name — no login. Vite + React + Tailwind 4 SPA talking directly to
Supabase under RLS (see `docs/adr/`). Deployable as a static site on Cloudflare
Workers.

**Live demo:** <https://scrum-tools.mlindhout.workers.dev/>

## How this was built

This app is a showcase of AI-assisted coding: I set the direction, agents did the
build. Every step left an artifact in this repo, so you can follow the trail.

1. **Inception.** I wrote a rough spec by hand — [`INCEPTION.md`](./INCEPTION.md):
   two Scrum tools, accountless rooms, a Fibonacci deck, a three-column retro. No
   architecture, just intent.
2. **Grilling.** I ran the `grill-with-docs` skill from
   [Matt Pocock's skills](https://github.com/mattpocock/skills) — a relentless
   interview that made me decide, not the model. The real calls came out here: no
   separate facilitator role, vote secrecy handled at the UI level, a
   capability-based RLS pattern. Those decisions were captured as a domain glossary
   ([`CONTEXT.md`](./CONTEXT.md)) and a set of [ADRs](./docs/adr/).
3. **PRD.** The `to-prd` skill synthesised that conversation into a product
   requirements doc and published it to the GitHub issue tracker — no new
   interview, just what we'd already settled.
4. **Issues.** The `to-issues` skill sliced the PRD into independently-grabbable
   [tracer-bullet issues](https://github.com/mlindhout/scrum-tools/issues?q=is%3Aissue),
   each a thin vertical slice through the whole stack.
5. **Autonomous build.** [Sandcastle](https://github.com/mattpocock/sandcastle)
   (the [`.sandcastle/`](./.sandcastle/) orchestrator) took it from there: it built
   a dependency graph over the open issues, spun up a sandbox per unblocked issue,
   ran an implementer then a reviewer on each branch concurrently, and merged the
   results — looping until the backlog was empty.

The stack the agents landed on: a Vite + React + Tailwind 4 SPA talking directly to
[Supabase](https://supabase.com) under row-level security, deployed as static assets
on [Cloudflare Workers](https://developers.cloudflare.com/workers/). The whole chain
ran on [Claude Code](https://claude.com/claude-code).

The agents shipped working software; the finishing touches — getting the RLS grants
right, the pastel colours in the retro, the move to Cloudflare — I did by hand.

## Develop

```bash
npm install
cp .env.example .env          # point at your Supabase project
npm run dev
```

## Scripts

| Command             | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Vite dev server                                  |
| `npm run build`     | Type-check + production build to `dist/`         |
| `npm run typecheck` | `tsc -b --noEmit`                                |
| `npm run test`      | Vitest (unit + skipped RLS integration)          |

## Backend

Apply `supabase/migrations/0001_room.sql` to your Supabase project. It creates
the `room` table and the capability RLS pattern: no SELECT policy (so Rooms
cannot be enumerated) and a `get_room` security-definer function that returns a
Room only when you already know its `nanoid` (ADR 0002).

The RLS integration test in `src/features/room/rls.integration.test.ts` runs
only when `SUPABASE_TEST_URL` and `SUPABASE_TEST_ANON_KEY` are set (e.g. from a
local `supabase start`); otherwise it is skipped.

## Layout

- `src/domain/` — pure, exhaustively unit-tested logic (name uniqueness, Room
  helpers). The primary test seam.
- `src/lib/` — Supabase client and local-storage identity.
- `src/features/room/` — Room data access, Presence, and UI (JoinGate, shell).
- `src/pages/` — landing and Room routes.

## Deploy

Two independent halves (see `docs/adr/0006-deploy-pipeline.md`):

**Frontend — Cloudflare Workers (static assets, via Workers Builds).** Connect the
repo in the CF dashboard; it builds and deploys on every push (previews per PR).
Configure there: build command `npm run build`, deploy command `npx wrangler deploy`
(the default), and env vars `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
`wrangler.jsonc` points the deploy at `dist/` and sets the SPA fallback
(`not_found_handling: "single-page-application"`) so deep links like `/:roomId`
serve `index.html`.

**Database — GitHub Action.** `.github/workflows/deploy-supabase.yml` runs
`supabase db push` to the prod project on pushes to `main` that touch
`supabase/migrations/**` (also runnable via `workflow_dispatch`). Migrations are
forward-only and additive so the parallel frontend/DB deploy stays safe. Set these
repository secrets:

| Secret                  | What                                                  |
| ----------------------- | ----------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Personal access token (Supabase dashboard → Account)  |
| `SUPABASE_PROJECT_ID`   | Project ref of the prod project                       |
| `SUPABASE_DB_PASSWORD`  | Database password of the prod project                 |
