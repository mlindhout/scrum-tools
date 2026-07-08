import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLastRoomId,
  getLastRoomId,
  getOrCreateClientId,
  getRoomMode,
  getStoredName,
  setLastRoomId,
  setRoomMode,
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

describe("per-room mode", () => {
  it("defaults to participant when nothing is stored", () => {
    expect(getRoomMode("room123")).toBe("participant");
  });

  it("round-trips a spectator choice per room", () => {
    setRoomMode("room123", "spectator");
    expect(getRoomMode("room123")).toBe("spectator");
    // Independent per room — a different room is still the default.
    expect(getRoomMode("other")).toBe("participant");
  });

  it("can switch back to participant", () => {
    setRoomMode("room123", "spectator");
    setRoomMode("room123", "participant");
    expect(getRoomMode("room123")).toBe("participant");
  });
});
