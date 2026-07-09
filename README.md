# Scrum Tools

Accountless planning poker & retrospectives. Create a Room, share the link,
join with a name — no login. Vite + React + Tailwind 4 SPA talking directly to
Supabase under RLS (see `docs/adr/`). Deployable as a static site on Cloudflare
Pages.

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
