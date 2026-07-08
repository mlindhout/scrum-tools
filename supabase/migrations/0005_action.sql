-- Slice 6: Retrospective — Actions.
--
-- An `action` is a follow-up item created from a Card but standing alone
-- afterwards: a required description, an optional free-text assignee and a
-- done-toggle. It keeps NO reference to its originating Card (PRD). Actions are
-- open: any present Member may edit, toggle or delete any Action — there is no
-- authorship column. Follows the same capability pattern as the rest of the
-- retro data (ADR 0002): NO select policy (the table cannot be enumerated),
-- reads go through a security-definer RPC keyed by the known Room id, and the
-- ON DELETE CASCADE FK lets the 90-day cleanup reach Actions too.

create table if not exists public.action (
  id               text primary key,
  retrospective_id text not null
                     references public.retrospective(id) on delete cascade,
  description      text not null check (char_length(description) between 1 and 2000),
  assignee        text check (assignee is null or char_length(assignee) <= 200),
  done            boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists action_retrospective_id_idx
  on public.action (retrospective_id);

alter table public.action enable row level security;

-- Writes are open to anon (there are no accounts); the client supplies the
-- unguessable id. Actions are open to every Member per the PRD, so update and
-- delete are unrestricted. NB: no SELECT policy → direct reads return zero rows;
-- reads go through `list_actions`.

drop policy if exists "anon writes action" on public.action;
create policy "anon writes action"
  on public.action for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon updates action" on public.action;
create policy "anon updates action"
  on public.action for update
  to anon, authenticated
  using (true) with check (true);

drop policy if exists "anon deletes action" on public.action;
create policy "anon deletes action"
  on public.action for delete
  to anon, authenticated
  using (true);

-- Capability read: all Actions across a Room's Retrospectives, only when the
-- Room id (the nanoid capability) is already known.
create or replace function public.list_actions(p_room_id text)
returns setof public.action
language sql
stable
security definer
set search_path = public
as $$
  select a.* from public.action a
  join public.retrospective r on r.id = a.retrospective_id
  where r.room_id = p_room_id
  order by a.created_at asc;
$$;

grant execute on function public.list_actions(text) to anon, authenticated;
