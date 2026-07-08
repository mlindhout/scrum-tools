-- Slice 6: table-level GRANTs for the anon capability path.
--
-- RLS policies gate WHICH rows a role may touch, but PostgreSQL first checks
-- table-level GRANTs. Slices 0001-0005 added policies but never granted the
-- underlying DML privileges, so anon hit "permission denied for table room"
-- (42501) before RLS was ever consulted. Grant exactly what each table's
-- policies allow. No SELECT: reads go through the security-definer RPCs
-- (get_room, list_*), which keeps Rooms and retros unenumerable (ADR 0002).
grant insert                 on public.room          to anon, authenticated;
grant insert, update         on public.retrospective to anon, authenticated;
grant insert, update, delete on public.card          to anon, authenticated;
grant insert, delete         on public.card_vote     to anon, authenticated;
grant insert, update, delete on public.action        to anon, authenticated;
