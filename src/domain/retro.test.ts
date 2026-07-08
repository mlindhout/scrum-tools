import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  COLUMN_IDS,
  actionsInRetrospective,
  canModifyCard,
  cardsInColumn,
  defaultRetroDate,
  hasVoted,
  isColumnId,
  normalizeAssignee,
  sortRetrospectivesNewestFirst,
  toggleCardVote,
  validateActionDescription,
  validateCardText,
  voteCount,
  type Action,
  type Card,
  type CardVote,
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

const vote = (cardId: string, clientId: string): CardVote => ({
  cardId,
  clientId,
});

describe("toggleCardVote", () => {
  it("adds a +1 when the Member has not voted on the Card", () => {
    const next = toggleCardVote([], "c1", "me");
    expect(next).toEqual([{ cardId: "c1", clientId: "me" }]);
  });

  it("removes the +1 when the Member has already voted (toggle off)", () => {
    const next = toggleCardVote([vote("c1", "me")], "c1", "me");
    expect(next).toEqual([]);
  });

  it("is one-per-clientId: toggling on twice never duplicates", () => {
    const once = toggleCardVote([], "c1", "me");
    const off = toggleCardVote(once, "c1", "me");
    const on = toggleCardVote(off, "c1", "me");
    expect(on).toEqual([{ cardId: "c1", clientId: "me" }]);
  });

  it("only affects the given Member's vote on the given Card", () => {
    const votes = [
      vote("c1", "me"),
      vote("c1", "you"),
      vote("c2", "me"),
    ];
    const next = toggleCardVote(votes, "c1", "me");
    expect(next).toEqual([vote("c1", "you"), vote("c2", "me")]);
  });

  it("allows a Member to +1 their own Card (author not special-cased)", () => {
    const next = toggleCardVote([], "mine", "author");
    expect(next).toEqual([{ cardId: "mine", clientId: "author" }]);
  });

  it("does not mutate the input array", () => {
    const votes = [vote("c1", "me")];
    toggleCardVote(votes, "c1", "me");
    toggleCardVote(votes, "c2", "me");
    expect(votes).toEqual([vote("c1", "me")]);
  });
});

describe("voteCount", () => {
  it("counts the +1's on a Card", () => {
    const votes = [vote("c1", "a"), vote("c1", "b"), vote("c2", "a")];
    expect(voteCount(votes, "c1")).toBe(2);
    expect(voteCount(votes, "c2")).toBe(1);
    expect(voteCount(votes, "c3")).toBe(0);
  });
});

describe("hasVoted", () => {
  it("reports whether a Member has +1'd a Card", () => {
    const votes = [vote("c1", "me")];
    expect(hasVoted(votes, "c1", "me")).toBe(true);
    expect(hasVoted(votes, "c1", "you")).toBe(false);
    expect(hasVoted(votes, "c2", "me")).toBe(false);
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

describe("validateActionDescription", () => {
  it("accepts and trims non-empty text", () => {
    expect(validateActionDescription("  call the client  ")).toEqual({
      ok: true,
      name: "call the client",
    });
  });

  it("rejects empty or whitespace-only text", () => {
    expect(validateActionDescription("   ").ok).toBe(false);
    expect(validateActionDescription("").ok).toBe(false);
  });

  it("rejects text beyond the max length", () => {
    expect(validateActionDescription("x".repeat(2001)).ok).toBe(false);
    expect(validateActionDescription("x".repeat(2000)).ok).toBe(true);
  });
});

describe("normalizeAssignee", () => {
  it("trims and keeps a non-empty assignee", () => {
    expect(normalizeAssignee("  Marc  ")).toBe("Marc");
  });

  it("treats empty or whitespace-only as no assignee (null)", () => {
    expect(normalizeAssignee("")).toBeNull();
    expect(normalizeAssignee("   ")).toBeNull();
    expect(normalizeAssignee(null)).toBeNull();
    expect(normalizeAssignee(undefined)).toBeNull();
  });
});

const action = (id: string, createdAt: string, done = false): Action => ({
  id,
  retrospectiveId: "retro",
  description: id,
  assignee: null,
  done,
  createdAt,
});

describe("actionsInRetrospective", () => {
  it("keeps only actions for the retrospective, oldest first", () => {
    const actions = [
      { ...action("a2", "2026-07-08T11:00:00Z"), retrospectiveId: "retro" },
      { ...action("other", "2026-07-08T10:00:00Z"), retrospectiveId: "x" },
      { ...action("a1", "2026-07-08T09:00:00Z"), retrospectiveId: "retro" },
    ];
    expect(actionsInRetrospective(actions, "retro").map((a) => a.id)).toEqual([
      "a1",
      "a2",
    ]);
    expect(actionsInRetrospective(actions, "none")).toEqual([]);
  });
});
