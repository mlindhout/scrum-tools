-- Slice 1: Room skeleton — the `room` table and the capability RLS pattern.
--
-- Access is governed entirely by RLS with the Room `nanoid` as the only
-- capability (ADR 0002). There is deliberately NO select policy, so a direct
-- `select * from room` returns nothing and Rooms cannot be enumerated. Reads
-- happen through the `get_room` security-definer function, which returns only
-- the single Room whose id the caller already knows.

create table if not exists public.room (
  id             text primary key,
  name           text not null check (char_length(name) between 1 and 60),
  created_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

alter table public.room enable row level security;

-- Anyone may create a Room; the client generates the unguessable id.
drop policy if exists "anon can create room" on public.room;
create policy "anon can create room"
  on public.room for insert
  to anon, authenticated
  with check (true);

-- NB: no SELECT / UPDATE / DELETE policies. Without a select policy, direct
-- table reads return zero rows for anon — this is what prevents enumeration.

-- Capability read: fetch a Room only when you already know its id.
create or replace function public.get_room(p_id text)
returns public.room
language sql
stable
security definer
set search_path = public
as $$
  select * from public.room where id = p_id;
$$;

-- Capability write: bump activity. Opening a Room already counts as activity.
create or replace function public.touch_room(p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.room set last_active_at = now() where id = p_id;
$$;

grant execute on function public.get_room(text) to anon, authenticated;
grant execute on function public.touch_room(text) to anon, authenticated;
