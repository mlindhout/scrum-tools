import { nanoid } from "nanoid";
import { supabase } from "../../lib/supabase";
import {
  isColumnId,
  type Action,
  type Card,
  type CardVote,
  type ColumnId,
  type Retrospective,
} from "../../domain/retro";

/**
 * Persistent retrospective access. Reads go through the `list_retrospectives` /
 * `list_cards` capability RPCs — you can only read a Room's retro data whose
 * `nanoid` you already know — because the tables have no SELECT policy and so
 * cannot be enumerated (ADR 0002). Writes are direct inserts/updates/deletes;
 * Card authorship is enforced in the app layer. Live sync rides Broadcast on
 * the Room channel (see `useRetroSync`), so mutations return only what a caller
 * needs and everyone refetches on the broadcast.
 */

interface RetroRow {
  id: string;
  room_id: string;
  date: string;
  locked: boolean;
  created_at: string;
}

interface CardRow {
  id: string;
  retrospective_id: string;
  column_id: string;
  text: string;
  author_client_id: string;
  created_at: string;
}

interface CardVoteRow {
  card_id: string;
  client_id: string;
  created_at: string;
}

interface ActionRow {
  id: string;
  retrospective_id: string;
  description: string;
  assignee: string | null;
  done: boolean;
  created_at: string;
}

function toAction(row: ActionRow): Action {
  return {
    id: row.id,
    retrospectiveId: row.retrospective_id,
    description: row.description,
    assignee: row.assignee,
    done: row.done,
    createdAt: row.created_at,
  };
}

function toRetro(row: RetroRow): Retrospective {
  return {
    id: row.id,
    roomId: row.room_id,
    date: row.date,
    locked: row.locked,
    createdAt: row.created_at,
  };
}

function toCard(row: CardRow): Card {
  // The DB constraint guarantees a known column id; fall back defensively.
  const column: ColumnId = isColumnId(row.column_id) ? row.column_id : "praise";
  return {
    id: row.id,
    retrospectiveId: row.retrospective_id,
    column,
    text: row.text,
    authorClientId: row.author_client_id,
    createdAt: row.created_at,
  };
}

/** Create a Retrospective in the Room with the given date label; return its id. */
export async function createRetrospective(
  roomId: string,
  date: string,
): Promise<string> {
  const id = nanoid();
  const { error } = await supabase
    .from("retrospective")
    .insert({ id, room_id: roomId, date });
  if (error) throw error;
  return id;
}

/** All of a Room's Retrospectives, newest first. */
export async function listRetrospectives(
  roomId: string,
): Promise<Retrospective[]> {
  const { data, error } = await supabase.rpc("list_retrospectives", {
    p_room_id: roomId,
  });
  if (error) throw error;
  return ((data as RetroRow[]) ?? []).map(toRetro);
}

/** Change a Retrospective's date label. */
export async function updateRetrospectiveDate(
  id: string,
  date: string,
): Promise<void> {
  const { error } = await supabase.rpc("update_retrospective_date", {
    p_id: id,
    p_date: date,
  });
  if (error) throw error;
}

/**
 * Lock or unlock a Retrospective. A locked retro is read-only in the app layer
 * (any Member may flip this). Goes through the `set_retrospective_locked`
 * capability RPC: a filtered UPDATE can't see rows with no SELECT policy, so
 * edits route through security-definer RPCs keyed by the known id (ADR 0002).
 */
export async function setRetrospectiveLocked(
  id: string,
  locked: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("set_retrospective_locked", {
    p_id: id,
    p_locked: locked,
  });
  if (error) throw error;
}

/** All Cards across a Room's Retrospectives (filter by retro in the UI). */
export async function listCards(roomId: string): Promise<Card[]> {
  const { data, error } = await supabase.rpc("list_cards", {
    p_room_id: roomId,
  });
  if (error) throw error;
  return ((data as CardRow[]) ?? []).map(toCard);
}

/** Place a Card with text in a Column; return its id. */
export async function createCard(
  retrospectiveId: string,
  column: ColumnId,
  text: string,
  authorClientId: string,
): Promise<string> {
  const id = nanoid();
  const { error } = await supabase.from("card").insert({
    id,
    retrospective_id: retrospectiveId,
    column_id: column,
    text,
    author_client_id: authorClientId,
  });
  if (error) throw error;
  return id;
}

/** Edit a Card's text (author-only; enforced by the caller). */
export async function updateCardText(id: string, text: string): Promise<void> {
  const { error } = await supabase.rpc("update_card_text", {
    p_id: id,
    p_text: text,
  });
  if (error) throw error;
}

/** Delete a Card (author-only; enforced by the caller). */
export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_card", { p_id: id });
  if (error) throw error;
}

/** All +1 votes across a Room's Cards (anonymous; only counts shown in the UI). */
export async function listCardVotes(roomId: string): Promise<CardVote[]> {
  const { data, error } = await supabase.rpc("list_card_votes", {
    p_room_id: roomId,
  });
  if (error) throw error;
  return ((data as CardVoteRow[]) ?? []).map((row) => ({
    cardId: row.card_id,
    clientId: row.client_id,
  }));
}

/**
 * Add a Member's +1 to a Card; the composite PK makes it one-per-`clientId`.
 *
 * A plain insert, not an upsert. PostgREST compiles `.upsert()` to
 * `INSERT ... ON CONFLICT`, whose conflict arbiter is checked against the
 * table's SELECT *policy* — but card_vote deliberately has none, so it cannot
 * be enumerated (ADR 0002). With no SELECT policy the arbiter check fails with
 * "new row violates row-level security policy" even for a brand-new row. So we
 * insert plainly and swallow the unique-violation: a duplicate +1 is already a
 * no-op by the composite PK (and the UI only calls this when not yet voted).
 */
export async function addCardVote(
  cardId: string,
  clientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("card_vote")
    .insert({ card_id: cardId, client_id: clientId });
  // 23505 = this Member already +1'd this Card; idempotent, so not an error.
  if (error && error.code !== "23505") throw error;
}

/** Remove a Member's +1 from a Card (idempotent). */
export async function removeCardVote(
  cardId: string,
  clientId: string,
): Promise<void> {
  const { error } = await supabase.rpc("remove_card_vote", {
    p_card_id: cardId,
    p_client_id: clientId,
  });
  if (error) throw error;
}

/** All Actions across a Room's Retrospectives (filter by retro in the UI). */
export async function listActions(roomId: string): Promise<Action[]> {
  const { data, error } = await supabase.rpc("list_actions", {
    p_room_id: roomId,
  });
  if (error) throw error;
  return ((data as ActionRow[]) ?? []).map(toAction);
}

/**
 * Create an Action on a Retrospective; return its id. The Action keeps no
 * reference to the Card it was created from (PRD). `assignee` is optional.
 */
export async function createAction(
  retrospectiveId: string,
  description: string,
  assignee: string | null,
): Promise<string> {
  const id = nanoid();
  const { error } = await supabase.from("action").insert({
    id,
    retrospective_id: retrospectiveId,
    description,
    assignee,
  });
  if (error) throw error;
  return id;
}

/** Edit an Action's description and assignee (open to any Member). */
export async function updateAction(
  id: string,
  description: string,
  assignee: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("update_action", {
    p_id: id,
    p_description: description,
    p_assignee: assignee,
  });
  if (error) throw error;
}

/** Mark an Action done or un-done (open to any Member). */
export async function setActionDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_action_done", {
    p_id: id,
    p_done: done,
  });
  if (error) throw error;
}

/** Delete an Action (open to any Member). */
export async function deleteAction(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_action", { p_id: id });
  if (error) throw error;
}
