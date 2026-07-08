import { describe, expect, it } from "vitest";
import { presentMembersFromState } from "./presence";

describe("presentMembersFromState", () => {
  it("flattens a Supabase presence state into members with their mode", () => {
    const state = {
      key1: [{ clientId: "a", name: "Marc", mode: "participant" }],
      key2: [{ clientId: "b", name: "Sanne", mode: "spectator" }],
    };
    expect(presentMembersFromState(state)).toEqual([
      { clientId: "a", name: "Marc", mode: "participant" },
      { clientId: "b", name: "Sanne", mode: "spectator" },
    ]);
  });

  it("defaults a mode-less entry to participant", () => {
    const state = { key1: [{ clientId: "a", name: "Marc" }] };
    expect(presentMembersFromState(state)).toEqual([
      { clientId: "a", name: "Marc", mode: "participant" },
    ]);
  });

  it("dedupes by clientId, keeping the first presence (reconnect races)", () => {
    const state = {
      key1: [{ clientId: "a", name: "Marc", mode: "participant" }],
      key2: [{ clientId: "a", name: "Marc", mode: "participant" }],
    };
    expect(presentMembersFromState(state)).toEqual([
      { clientId: "a", name: "Marc", mode: "participant" },
    ]);
  });

  it("ignores presence entries missing identity fields", () => {
    const state = {
      key1: [{ clientId: "a", name: "Marc", mode: "participant" }],
      key2: [{ foo: "bar" }],
    };
    expect(presentMembersFromState(state)).toEqual([
      { clientId: "a", name: "Marc", mode: "participant" },
    ]);
  });
});
