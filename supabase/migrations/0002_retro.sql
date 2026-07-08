-- Slice 4: Retrospective — persistent board & Cards, scoped to a Room by RLS.
--
-- Like `room` (ADR 0002), retro data is capability-gated by the Room `nanoid`:
-- there is deliberately NO select policy on either table, so a blanket
-- `select * from retrospective` / `card` returns nothing and neither can be
-- enumerated. Reads go through security-definer functions keyed by a known
-- Room id. Live sync rides Supabase Realtime *Broadcast* on the Room channel
-- (not `postgres_changes`, which would require an enumerable select policy).

create table if not exists public.retrospective (
  id         text primary key,
  room_id    text not null references public.room(id) on delete cascade,
  date       text not null check (char_length(date) between 1 and 40),
  locked     boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists retrospective_room_id_idx
  on public.retrospective (room_id);

create table if not exists public.card (
  id               text primary key,
  retrospective_id text not null
                     references public.retrospective(id) on delete cascade,
  -- `column` is a reserved word; store the Column id as `column_id`.
  column_id        text not null check (column_id in ('praise', 'start', 'stop')),
  text             text not null check (char_length(text) between 1 and 2000),
  author_client_id text not null,
  created_at       timestamptz not null default now()
);

create index if not exists card_retrospective_id_idx
  on public.card (retrospective_id);

alter table public.retrospective enable row level security;
alter table public.card enable row level security;

-- Writes are open to anon (there are no accounts); the client supplies the
-- unguessable ids. Card authorship (edit/delete only your own) is enforced in
-- the app layer per the PRD — RLS only prevents enumeration, not mutation.
-- NB: no SELECT policy on either table → direct reads return zero rows.

drop policy if exists "anon writes retrospective" on public.retrospective;
create policy "anon writes retrospective"
  on public.retrospective for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon updates retrospective" on public.retrospective;
create policy "anon updates retrospective"
  on public.retrospective for update
  to anon, authenticated
  using (true) with check (true);

drop policy if exists "anon writes card" on public.card;
create policy "anon writes card"
  on public.card for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon updates card" on public.card;
create policy "anon updates card"
  on public.card for update
  to anon, authenticated
  using (true) with check (true);

drop policy if exists "anon deletes card" on public.card;
create policy "anon deletes card"
  on public.card for delete
  to anon, authenticated
  using (true);

-- Capability reads: list a Room's retrospectives / cards only when the Room id
-- (the nanoid capability) is already known. Newest-first ordering is also done
-- in the pure domain layer, but ordering here keeps the wire payload tidy.
create or replace function public.list_retrospectives(p_room_id text)
returns setof public.retrospective
language sql
stable
security definer
set search_path = public
as $$
  select * from public.retrospective
  where room_id = p_room_id
  order by created_at desc;
$$;

create or replace function public.list_cards(p_room_id text)
returns setof public.card
language sql
stable
security definer
set search_path = public
as $$
  select c.* from public.card c
  join public.retrospective r on r.id = c.retrospective_id
  where r.room_id = p_room_id
  order by c.created_at asc;
$$;

grant execute on function public.list_retrospectives(text) to anon, authenticated;
grant execute on function public.list_cards(text) to anon, authenticated;
