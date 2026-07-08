import { nanoid } from "nanoid";
import { supabase } from "../../lib/supabase";
import {
  isColumnId,
  type Card,
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
  const { error } = await supabase
    .from("retrospective")
    .update({ date })
    .eq("id", id);
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
  const { error } = await supabase.from("card").update({ text }).eq("id", id);
  if (error) throw error;
}

/** Delete a Card (author-only; enforced by the caller). */
export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from("card").delete().eq("id", id);
  if (error) throw error;
}
