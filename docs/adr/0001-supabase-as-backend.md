# Supabase als backend (persistence + realtime)

We gebruiken Supabase (Postgres + Realtime + presence) als enige backend. Beide tools zijn multi-user en real-time (kaarten flippen, live +1's, presence), terwijl data persistent moet zijn (rooms 90 dagen, gedateerde retrospectives). Supabase dekt realtime én persistente opslag in één gratis product, zodat we geen eigen WebSocket-server hoeven te onderhouden. De React/Tailwind-frontend wordt los als static site gehost.

## Considered Options

- **Supabase** — gekozen: Postgres + Realtime in één free tier.
- **Eigen Node WebSocket-server + aparte DB** — meer controle, maar meer ops en free tiers die de server laten slapen.
- **Realtime-first BaaS (PartyKit/Liveblocks)** — sterk voor live state, maar 90-daagse persistentie en gedateerde retro's moeten er alsnog bij.
