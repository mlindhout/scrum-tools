# Deploy: Cloudflare Workers bouwt de frontend, een GitHub Action pusht migraties

De deploy is opgesplitst langs de twee helften van de stack (zie ADR 0001, 0004).
De **frontend** deployt zichzelf: Cloudflare Workers Builds checkt de repo uit,
draait `npm run build` en deployt via `npx wrangler deploy` de `dist/` als
static assets (`wrangler.jsonc`) bij elke push — inclusief preview-deploys per PR.
De SPA-fallback zit in `wrangler.jsonc` (`not_found_handling: single-page-application`),
niet meer in `public/_redirects`. Het build command en de `VITE_SUPABASE_*` env-vars
staan in het CF-dashboard, de assets-config in de repo. De **database** heeft één
GitHub Action (`.github/workflows/deploy-supabase.yml`) die `supabase db push`
draait naar het ene prod-project, getriggerd op push naar `main` en alleen wanneer
`supabase/migrations/**` verandert. Geen aparte staging-database; RLS en reversibele
migraties zijn het vangnet (ADR 0002).

Beide helften triggeren onafhankelijk op dezelfde merge en lopen dus **parallel** —
er is geen coördinatie die de migratie vóór de frontend-publicatie garandeert. Om
het resulterende venster (nieuwe UI live, migratie nog niet toegepast) onschadelijk
te houden geldt het beleid: **migraties zijn forward-only en additief**. Frontend
die een nieuwe RPC of kolom nodig heeft, mag ervan uitgaan dat die additief is en
binnen seconden bestaat; een migratie verwijdert of hernoemt nooit iets waar live
frontend nog van afhangt. Zo blijft de parallelle deploy veilig zonder een deploy-hook
of andere koppeling die CF's native trigger deels zou opgeven.

## Considered Options

- **CF Workers Builds + Action-alleen-voor-migraties** — gekozen: CF doet waar het goed
  in is (gratis build + previews), de Action doet puur de DB. Weinig secrets in GitHub,
  weinig te onderhouden.
- **Eén Action bouwt én deployt beide** (Wrangler + `db push`) — één bron van waarheid en
  strakke volgorde-controle, maar herbouwt wat CF gratis kan en verplaatst CF-secrets naar
  GitHub. Afgewezen.
- **Deploy-hook: Action triggert CF ná `db push`** — garandeert migratie-vóór-frontend,
  maar introduceert een tweede deploy-mechanisme naast CF's native trigger. Afgewezen ten
  gunste van het additief-migratiebeleid.
- **Aparte staging-database** — veiliger bij riskante migraties, maar dubbel beheer en een
  tweede free-tier-project dat kan slapen. Afgewezen op deze schaal.
