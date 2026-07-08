import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  COLUMN_IDS,
  canModifyCard,
  cardsInColumn,
  defaultRetroDate,
  isColumnId,
  sortRetrospectivesNewestFirst,
  validateCardText,
  type Card,
  type Retrospective,
} from "./retro";

describe("COLUMNS", () => {
  it("are the three fixed retrospective columns in order", () => {
    expect(COLUMNS.map((c) => c.id)).toEqual(["praise", "start", "stop"]);
    expect(COLUMNS.map((c) => c.title)).toEqual([
      "Praise",
      "We should start…",
      "We should stop…",
    ]);
  });
});

describe("isColumnId", () => {
  it("accepts the three known column ids", () => {
    for (const id of COLUMN_IDS) expect(isColumnId(id)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isColumnId("praises")).toBe(false);
    expect(isColumnId("")).toBe(false);
    expect(isColumnId(null)).toBe(false);
    expect(isColumnId(42)).toBe(false);
  });
});

describe("defaultRetroDate", () => {
  it("formats the given day as a local YYYY-MM-DD label", () => {
    expect(defaultRetroDate(new Date(2026, 6, 8))).toBe("2026-07-08");
    expect(defaultRetroDate(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(defaultRetroDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("validateCardText", () => {
  it("accepts and trims non-empty text", () => {
    expect(validateCardText("  ship it  ")).toEqual({
      ok: true,
      name: "ship it",
    });
  });

  it("rejects empty or whitespace-only text", () => {
    expect(validateCardText("   ").ok).toBe(false);
    expect(validateCardText("").ok).toBe(false);
  });

  it("rejects text beyond the max length", () => {
    expect(validateCardText("x".repeat(2001)).ok).toBe(false);
    expect(validateCardText("x".repeat(2000)).ok).toBe(true);
  });
});

describe("canModifyCard", () => {
  it("only the author (by clientId) may edit or delete a Card", () => {
    const card = { authorClientId: "abc" };
    expect(canModifyCard(card, "abc")).toBe(true);
    expect(canModifyCard(card, "xyz")).toBe(false);
  });
});

const retro = (id: string, createdAt: string): Retrospective => ({
  id,
  roomId: "r",
  date: "2026-07-08",
  locked: false,
  createdAt,
});

describe("sortRetrospectivesNewestFirst", () => {
  it("orders retrospectives by creation time, newest first", () => {
    const list = [
      retro("a", "2026-07-01T10:00:00Z"),
      retro("c", "2026-07-08T09:00:00Z"),
      retro("b", "2026-07-04T12:00:00Z"),
    ];
    expect(sortRetrospectivesNewestFirst(list).map((r) => r.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("does not mutate the input array", () => {
    const list = [
      retro("a", "2026-07-01T10:00:00Z"),
      retro("b", "2026-07-04T12:00:00Z"),
    ];
    sortRetrospectivesNewestFirst(list);
    expect(list.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

const card = (id: string, column: Card["column"], createdAt: string): Card => ({
  id,
  retrospectiveId: "retro",
  column,
  text: id,
  authorClientId: "me",
  createdAt,
});

describe("cardsInColumn", () => {
  it("keeps only cards for the column, oldest first", () => {
    const cards = [
      card("p2", "praise", "2026-07-08T11:00:00Z"),
      card("s1", "stop", "2026-07-08T10:00:00Z"),
      card("p1", "praise", "2026-07-08T09:00:00Z"),
    ];
    expect(cardsInColumn(cards, "praise").map((c) => c.id)).toEqual([
      "p1",
      "p2",
    ]);
    expect(cardsInColumn(cards, "start")).toEqual([]);
  });
});
