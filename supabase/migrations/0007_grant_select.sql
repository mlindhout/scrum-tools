-- Slice 7: SELECT privilege for the anon capability path.
--
-- Postgres requires SELECT privilege on a table's columns for any UPDATE or
-- DELETE whose WHERE clause references them, and for INSERT ... ON CONFLICT
-- (upsert). The client issues filtered updates/deletes (card / action / retro
-- by id, card_vote by its composite key) and upserts +1 votes, so without
-- SELECT it hits 42501 "permission denied" before RLS is ever consulted.
--
-- Granting SELECT does NOT make the tables enumerable: there is still no SELECT
-- *policy*, so with RLS enabled every direct read returns zero rows. Reads go
-- exclusively through the security-definer get_room / list_* RPCs (ADR 0002).
grant select on public.room          to anon, authenticated;
grant select on public.retrospective to anon, authenticated;
grant select on public.card          to anon, authenticated;
grant select on public.card_vote     to anon, authenticated;
grant select on public.action        to anon, authenticated;
