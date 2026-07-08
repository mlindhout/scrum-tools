import { supabase } from "../../lib/supabase";
import { newRoomId } from "../../domain/room";

/**
 * Persistent Room access. Reads go through the `get_room` capability RPC — you
 * can only fetch a Room whose `nanoid` you already know — because the `room`
 * table has no SELECT policy and therefore cannot be enumerated (see ADR 0002).
 */

export interface Room {
  id: string;
  name: string;
}

/** Create a Room with a fresh unguessable id and return it. */
export async function createRoom(name: string): Promise<Room> {
  const id = newRoomId();
  const { error } = await supabase.from("room").insert({ id, name });
  if (error) throw error;
  return { id, name };
}

/** Fetch a Room by its capability id, or null if it does not exist. */
export async function fetchRoom(id: string): Promise<Room | null> {
  const { data, error } = await supabase.rpc("get_room", { p_id: id });
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, name: data.name };
}

/** Bump the Room's activity clock (opening a Room counts as activity). */
export async function touchRoom(id: string): Promise<void> {
  const { error } = await supabase.rpc("touch_room", { p_id: id });
  if (error) throw error;
}

/**
 * Rename a Room. Goes through the `rename_room` capability RPC (the `room` table
 * has no UPDATE policy — see ADR 0002); the RPC re-validates the name and bumps
 * the activity clock. Any Member who can reach the Room may rename it.
 */
export async function renameRoom(id: string, name: string): Promise<void> {
  const { error } = await supabase.rpc("rename_room", {
    p_id: id,
    p_name: name,
  });
  if (error) throw error;
}
