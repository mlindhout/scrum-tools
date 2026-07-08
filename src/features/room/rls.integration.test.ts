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
});
