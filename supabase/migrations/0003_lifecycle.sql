-- Slice 8: Room lifecycle — rename capability & 90-day inactivity cleanup.
--
-- Two capabilities keyed by the known Room `nanoid` (ADR 0002):
--   1. `rename_room` — any Member may rename a Room they can reach. The `room`
--      table has no UPDATE policy (no enumeration; writes go through RPCs), so
--      the rename runs in a security-definer function that also bumps activity.
--   2. `cleanup_stale_rooms` — deletes Rooms untouched for more than 90 days.
--      A daily `pg_cron` job runs it; ON DELETE CASCADE FKs from the child
--      tables (retrospective, card, and future +1/action tables) do the rest.

-- Rename a Room (and count it as activity). Name rules mirror the table check
-- and the client-side validateRoomName: 1–60 chars after trimming.
create or replace function public.rename_room(p_id text, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'invalid room name';
  end if;
  update public.room
     set name = btrim(p_name),
         last_active_at = now()
   where id = p_id;
end;
$$;

grant execute on function public.rename_room(text, text) to anon, authenticated;

-- Delete Rooms inactive for more than 90 days; returns how many were removed.
-- The `<` matches isRoomExpired in the domain layer: a Room exactly 90 days old
-- survives, one strictly older is cleaned up. Deletion cascades to children.
create or replace function public.cleanup_stale_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  with removed as (
    delete from public.room
     where last_active_at < now() - interval '90 days'
    returning 1
  )
  select count(*) into deleted from removed;
  return deleted;
end;
$$;

-- Safe to expose: it only removes Rooms already past the inactivity limit, and
-- the integration test drives it directly.
grant execute on function public.cleanup_stale_rooms() to anon, authenticated;

-- Schedule the cleanup daily at 03:00 UTC. `cron.schedule` upserts by job name,
-- so re-running the migration re-points the same job rather than duplicating it.
create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-stale-rooms',
  '0 3 * * *',
  $$select public.cleanup_stale_rooms()$$
);
