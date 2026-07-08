import { describe, expect, it } from "vitest";
import {
  ROOM_INACTIVITY_LIMIT_DAYS,
  isRoomExpired,
  newRoomId,
  validateDisplayName,
  validateRoomName,
} from "./room";

describe("validateRoomName", () => {
  it("accepts a non-empty name and trims it", () => {
    expect(validateRoomName("  Sprint 42  ")).toEqual({
      ok: true,
      name: "Sprint 42",
    });
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(validateRoomName("   ").ok).toBe(false);
    expect(validateRoomName("").ok).toBe(false);
  });
});

describe("validateDisplayName", () => {
  it("accepts and trims a non-empty name", () => {
    expect(validateDisplayName("  Marc ")).toEqual({ ok: true, name: "Marc" });
  });

  it("rejects an empty name", () => {
    expect(validateDisplayName("  ").ok).toBe(false);
  });
});

describe("isRoomExpired", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = new Date("2026-07-08T12:00:00Z");

  it("keeps a Room active well within the limit", () => {
    const fresh = new Date(now.getTime() - 5 * DAY_MS);
    expect(isRoomExpired(fresh, now)).toBe(false);
  });

  it("expires a Room past the 90-day inactivity limit", () => {
    const stale = new Date(now.getTime() - (ROOM_INACTIVITY_LIMIT_DAYS + 1) * DAY_MS);
    expect(isRoomExpired(stale, now)).toBe(true);
  });

  it("does not expire a Room exactly at the limit (mirrors the SQL `<`)", () => {
    const exactly = new Date(now.getTime() - ROOM_INACTIVITY_LIMIT_DAYS * DAY_MS);
    expect(isRoomExpired(exactly, now)).toBe(false);
  });
});

describe("newRoomId", () => {
  it("produces a 21-character nanoid", () => {
    expect(newRoomId()).toHaveLength(21);
  });

  it("produces distinct ids", () => {
    expect(newRoomId()).not.toBe(newRoomId());
  });
});
