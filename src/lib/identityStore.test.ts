import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLastRoomId,
  getLastRoomId,
  getOrCreateClientId,
  getStoredName,
  setLastRoomId,
  setStoredName,
} from "./identityStore";

beforeEach(() => localStorage.clear());

describe("getOrCreateClientId", () => {
  it("generates a stable id that survives across calls", () => {
    const first = getOrCreateClientId();
    expect(first).toHaveLength(21);
    expect(getOrCreateClientId()).toBe(first);
  });

  it("persists the id to local storage", () => {
    const id = getOrCreateClientId();
    expect(localStorage.getItem("scrum-tools:clientId")).toBe(id);
  });
});

describe("display name", () => {
  it("is null before anything is stored", () => {
    expect(getStoredName()).toBeNull();
  });

  it("is reused across rooms once stored", () => {
    setStoredName("Marc");
    expect(getStoredName()).toBe("Marc");
  });
});

describe("last-used room", () => {
  it("round-trips the last room id", () => {
    expect(getLastRoomId()).toBeNull();
    setLastRoomId("room123");
    expect(getLastRoomId()).toBe("room123");
  });

  it("can be cleared when the room no longer exists", () => {
    setLastRoomId("gone");
    clearLastRoomId();
    expect(getLastRoomId()).toBeNull();
  });
});
