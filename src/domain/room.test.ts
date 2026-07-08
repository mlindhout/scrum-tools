import { describe, expect, it } from "vitest";
import { newRoomId, validateDisplayName, validateRoomName } from "./room";

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

describe("newRoomId", () => {
  it("produces a 21-character nanoid", () => {
    expect(newRoomId()).toHaveLength(21);
  });

  it("produces distinct ids", () => {
    expect(newRoomId()).not.toBe(newRoomId());
  });
});
