import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { nanoid } from "nanoid";

/**
 * RLS capability integration test (ADR 0002). Runs only against a real local
 * Supabase — set SUPABASE_TEST_URL and SUPABASE_TEST_ANON_KEY (e.g. from
 * `supabase start`) to enable it. It proves two things that can only be
 * verified against Postgres:
 *   1. A Room is reachable via the `get_room` capability when its id is known.
 *   2. Rooms cannot be enumerated with a blanket select.
 */

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const enabled = Boolean(url && anonKey);

describe.skipIf(!enabled)("room RLS capability", () => {
  // Only constructed when enabled; the suite is skipped otherwise.
  const client = createClient(url ?? "http://localhost:54321", anonKey ?? "x", {
    auth: { persistSession: false },
  });

  it("creates a Room and fetches it only via its known id", async () => {
    const id = nanoid();
    const name = `Test ${nanoid(6)}`;

    const insert = await client.from("room").insert({ id, name });
    expect(insert.error).toBeNull();

    const known = await client.rpc("get_room", { p_id: id });
    expect(known.error).toBeNull();
    expect(known.data).toMatchObject({ id, name });

    const unknown = await client.rpc("get_room", { p_id: nanoid() });
    expect(unknown.error).toBeNull();
    expect(unknown.data).toBeNull();
  });

  it("cannot enumerate Rooms with a blanket select", async () => {
    // Ensure at least one Room exists.
    await client.from("room").insert({ id: nanoid(), name: "Secret" });

    const { data, error } = await client.from("room").select("*");
    // Either RLS returns an empty set (no select policy) — never the full table.
    expect(error === null ? data : []).toEqual([]);
  });

  it("reads retro data only via the Room capability, never by enumeration", async () => {
    const roomId = nanoid();
    await client.from("room").insert({ id: roomId, name: "Retro room" });

    const retroId = nanoid();
    const retroInsert = await client
      .from("retrospective")
      .insert({ id: retroId, room_id: roomId, date: "2026-07-08" });
    expect(retroInsert.error).toBeNull();

    const cardId = nanoid();
    const cardInsert = await client.from("card").insert({
      id: cardId,
      retrospective_id: retroId,
      column_id: "praise",
      text: "Great sprint",
      author_client_id: nanoid(),
    });
    expect(cardInsert.error).toBeNull();

    const voterClientId = nanoid();
    const voteInsert = await client
      .from("card_vote")
      .insert({ card_id: cardId, client_id: voterClientId });
    expect(voteInsert.error).toBeNull();

    // Known Room id → capability RPCs return the rows.
    const retros = await client.rpc("list_retrospectives", {
      p_room_id: roomId,
    });
    expect(retros.error).toBeNull();
    expect(retros.data).toHaveLength(1);
    expect(retros.data?.[0]).toMatchObject({ id: retroId, room_id: roomId });

    const cards = await client.rpc("list_cards", { p_room_id: roomId });
    expect(cards.error).toBeNull();
    expect(cards.data).toHaveLength(1);
    expect(cards.data?.[0]).toMatchObject({ column_id: "praise" });

    const cardVotes = await client.rpc("list_card_votes", {
      p_room_id: roomId,
    });
    expect(cardVotes.error).toBeNull();
    expect(cardVotes.data).toHaveLength(1);
    expect(cardVotes.data?.[0]).toMatchObject({
      card_id: cardId,
      client_id: voterClientId,
    });

    // One +1 per Member per Card — a duplicate insert is rejected by the PK.
    const dupVote = await client
      .from("card_vote")
      .insert({ card_id: cardId, client_id: voterClientId });
    expect(dupVote.error).not.toBeNull();

    // Unknown Room id → nothing.
    const otherRetros = await client.rpc("list_retrospectives", {
      p_room_id: nanoid(),
    });
    expect(otherRetros.data ?? []).toEqual([]);

    // Blanket selects are blocked (no SELECT policy) — no enumeration.
    const allRetros = await client.from("retrospective").select("*");
    expect(allRetros.error === null ? allRetros.data : []).toEqual([]);
    const allCards = await client.from("card").select("*");
    expect(allCards.error === null ? allCards.data : []).toEqual([]);
    const allVotes = await client.from("card_vote").select("*");
    expect(allVotes.error === null ? allVotes.data : []).toEqual([]);
  });
});
