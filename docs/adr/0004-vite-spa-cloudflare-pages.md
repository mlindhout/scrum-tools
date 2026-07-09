# Kale Vite + React SPA op Cloudflare (static assets), bewust geen Next.js

De frontend is een kale Vite + React single-page app, gehost als static site op Cloudflare. Omdat er geen eigen server is (de browser praat direct met Supabase onder RLS, zie ADR 0002), is er geen SSR of server-side rendering-laag nodig. Next.js zou serverfuncties en SSR meebrengen die we niet gebruiken — puur overhead en verwarring over waar logica hoort. Client-side routing: `/` = landing, `/:roomId` = room.

Oorspronkelijk gekozen als **Cloudflare Pages**; sinds Cloudflare nieuwe projecten naar **Workers (static assets)** stuurt, hosten we de SPA als een assets-only Worker (`wrangler.jsonc`, `npx wrangler deploy`). De kern van deze beslissing — kale static SPA, geen Next.js — verandert daar niet door; alleen het Cloudflare-product. De deploy-pipeline staat in ADR 0006.

## Considered Options

- **Vite SPA op Cloudflare (Workers static assets)** — gekozen: minimaal, gratis, past bij serverless-direct-client.
- **Next.js** — afgewezen: SSR/serverfuncties die we bewust niet inzetten.
- Vercel / Netlify als host — gelijkwaardige gratis alternatieven; Cloudflare gekozen om zijn royale limieten.
