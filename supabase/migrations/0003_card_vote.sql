-- Slice 5: Retrospective — +1 voting on Cards.
--
-- A `card_vote` is an anonymous +1: at most one per Member (`client_id`) per
-- Card, enforced by a composite primary key. Votes follow the same capability
-- pattern as the rest of the retro data (ADR 0002): NO select policy (the table
-- cannot be enumerated), reads go through a security-definer RPC keyed by the
-- known Room id, and only the count / your-own-vote is ever surfaced in the UI.

create table if not exists public.card_vote (
  card_id   text not null references public.card(id) on delete cascade,
  client_id text not null,
  created_at timestamptz not null default now(),
  primary key (card_id, client_id)
);

create index if not exists card_vote_card_id_idx
  on public.card_vote (card_id);

alter table public.card_vote enable row level security;

-- Writes are open to anon (there are no accounts); the composite PK enforces
-- one +1 per Member per Card. Adding your own +1 is fine. No SELECT policy →
-- direct reads return zero rows; reads go through `list_card_votes`.

drop policy if exists "anon writes card_vote" on public.card_vote;
create policy "anon writes card_vote"
  on public.card_vote for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon deletes card_vote" on public.card_vote;
create policy "anon deletes card_vote"
  on public.card_vote for delete
  to anon, authenticated
  using (true);

-- Capability read: all +1's across a Room's Cards, only when the Room id (the
-- nanoid capability) is already known.
create or replace function public.list_card_votes(p_room_id text)
returns setof public.card_vote
language sql
stable
security definer
set search_path = public
as $$
  select v.* from public.card_vote v
  join public.card c on c.id = v.card_id
  join public.retrospective r on r.id = c.retrospective_id
  where r.room_id = p_room_id;
$$;

grant execute on function public.list_card_votes(text) to anon, authenticated;
