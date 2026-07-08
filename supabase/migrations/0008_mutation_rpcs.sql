-- Slice 8: capability RPCs for the filtered edits/deletes.
--
-- A filtered UPDATE/DELETE can only touch rows that are SELECT-visible, but the
-- retro tables deliberately have no SELECT policy (no enumeration, ADR 0002).
-- So a direct `update ... where id = ?` / `delete ... where id = ?` from anon
-- matched zero rows and silently no-op'd (HTTP 2xx, nothing changed). The room
-- mutations already dodged this by going through security-definer RPCs
-- (rename_room, touch_room); this slice extends that same pattern to the retro
-- child tables. The functions run as owner (bypassing RLS) and touch only the
-- single row named by its capability id, so nothing becomes enumerable. Table
-- CHECK constraints still apply. Authorship (edit/delete only your own Card) is
-- enforced in the app layer as before.

-- The old direct update/delete policies are dead now (they could never see a
-- row) and would only mislead; drop them. INSERT policies stay — inserts have
-- no WHERE and work directly.
drop policy if exists "anon updates retrospective" on public.retrospective;
drop policy if exists "anon updates card" on public.card;
drop policy if exists "anon deletes card" on public.card;
drop policy if exists "anon deletes card_vote" on public.card_vote;
drop policy if exists "anon updates action" on public.action;
drop policy if exists "anon deletes action" on public.action;

-- Retrospective ---------------------------------------------------------------
create or replace function public.update_retrospective_date(p_id text, p_date text)
returns void language sql security definer set search_path = public as $$
  update public.retrospective set date = p_date where id = p_id;
$$;

create or replace function public.set_retrospective_locked(p_id text, p_locked boolean)
returns void language sql security definer set search_path = public as $$
  update public.retrospective set locked = p_locked where id = p_id;
$$;

-- Card ------------------------------------------------------------------------
create or replace function public.update_card_text(p_id text, p_text text)
returns void language sql security definer set search_path = public as $$
  update public.card set text = p_text where id = p_id;
$$;

create or replace function public.delete_card(p_id text)
returns void language sql security definer set search_path = public as $$
  delete from public.card where id = p_id;
$$;

-- Card +1 votes ---------------------------------------------------------------
create or replace function public.remove_card_vote(p_card_id text, p_client_id text)
returns void language sql security definer set search_path = public as $$
  delete from public.card_vote where card_id = p_card_id and client_id = p_client_id;
$$;

-- Action ----------------------------------------------------------------------
create or replace function public.update_action(p_id text, p_description text, p_assignee text)
returns void language sql security definer set search_path = public as $$
  update public.action set description = p_description, assignee = p_assignee where id = p_id;
$$;

create or replace function public.set_action_done(p_id text, p_done boolean)
returns void language sql security definer set search_path = public as $$
  update public.action set done = p_done where id = p_id;
$$;

create or replace function public.delete_action(p_id text)
returns void language sql security definer set search_path = public as $$
  delete from public.action where id = p_id;
$$;

grant execute on function public.update_retrospective_date(text, text) to anon, authenticated;
grant execute on function public.set_retrospective_locked(text, boolean) to anon, authenticated;
grant execute on function public.update_card_text(text, text) to anon, authenticated;
grant execute on function public.delete_card(text) to anon, authenticated;
grant execute on function public.remove_card_vote(text, text) to anon, authenticated;
grant execute on function public.update_action(text, text, text) to anon, authenticated;
grant execute on function public.set_action_done(text, boolean) to anon, authenticated;
grant execute on function public.delete_action(text) to anon, authenticated;
