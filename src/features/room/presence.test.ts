import { describe, expect, it } from "vitest";
import { presentMembersFromState } from "./presence";

describe("presentMembersFromState", () => {
  it("flattens a Supabase presence state into members", () => {
    const state = {
      key1: [{ clientId: "a", name: "Marc" }],
      key2: [{ clientId: "b", name: "Sanne" }],
    };
    expect(presentMembersFromState(state)).toEqual([
      { clientId: "a", name: "Marc" },
      { clientId: "b", name: "Sanne" },
    ]);
  });

  it("dedupes by clientId, keeping the first presence (reconnect races)", () => {
    const state = {
      key1: [{ clientId: "a", name: "Marc" }],
      key2: [{ clientId: "a", name: "Marc" }],
    };
    expect(presentMembersFromState(state)).toEqual([
      { clientId: "a", name: "Marc" },
    ]);
  });

  it("ignores presence entries missing identity fields", () => {
    const state = {
      key1: [{ clientId: "a", name: "Marc" }],
      key2: [{ foo: "bar" }],
    };
    expect(presentMembersFromState(state)).toEqual([
      { clientId: "a", name: "Marc" },
    ]);
  });
});
