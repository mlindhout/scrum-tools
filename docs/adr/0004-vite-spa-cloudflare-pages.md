# Kale Vite + React SPA op Cloudflare Pages, bewust geen Next.js

De frontend is een kale Vite + React single-page app, gehost als static site op Cloudflare Pages. Omdat er geen eigen server is (de browser praat direct met Supabase onder RLS, zie ADR 0002), is er geen SSR of server-side rendering-laag nodig. Next.js zou serverfuncties en SSR meebrengen die we niet gebruiken — puur overhead en verwarring over waar logica hoort. Client-side routing: `/` = landing, `/:roomId` = room.

## Considered Options

- **Vite SPA + Cloudflare Pages** — gekozen: minimaal, gratis, past bij serverless-direct-client.
- **Next.js** — afgewezen: SSR/serverfuncties die we bewust niet inzetten.
- Vercel / Netlify als host — gelijkwaardige gratis alternatieven; Cloudflare Pages gekozen om zijn royale limieten.
