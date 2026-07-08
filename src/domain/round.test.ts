import { describe, expect, it } from "vitest";
import {
  DECK,
  ROUND_DURATION_MS,
  everyoneVoted,
  initialRound,
  isExpired,
  remainingMs,
  revealedVotes,
  roundReducer,
  tableCards,
  type DeckValue,
  type Member,
  type RoundEvent,
  type RoundState,
} from "./round";

const members = (...ids: string[]): Member[] =>
  ids.map((id) => ({ clientId: id, name: id.toUpperCase() }));

/** Fold a sequence of events over a starting state. */
const run = (state: RoundState, ...events: RoundEvent[]): RoundState =>
  events.reduce(roundReducer, state);

const voting = (...ids: string[]): RoundState =>
  run(initialRound(members(...ids)), { type: "startRound", at: 1000 });

describe("Deck", () => {
  it("is the fixed set with `?` last", () => {
    expect(DECK).toEqual([
      "0",
      "1",
      "2",
      "3",
      "5",
      "8",
      "13",
      "20",
      "40",
      "100",
      "?",
    ]);
  });
});

describe("initialRound", () => {
  it("starts idle with no timer and no votes", () => {
    const s = initialRound(members("a", "b"));
    expect(s).toEqual({
      phase: "idle",
      startedAt: null,
      members: members("a", "b"),
      votes: {},
    });
  });
});

describe("startRound", () => {
  it("enters voting, sets the shared start time, and clears prior votes", () => {
    const s = run(
      voting("a"),
      { type: "castVote", clientId: "a", value: "5" },
      // a new round while revealed/voting wipes the slate
    );
    const restarted = roundReducer(s, { type: "startRound", at: 2000 });
    expect(restarted.phase).toBe("voting");
    expect(restarted.startedAt).toBe(2000);
    expect(restarted.votes).toEqual({});
  });

  it("can be started by anyone from a revealed round (results replaced)", () => {
    let s = voting("a", "b");
    s = run(
      s,
      { type: "castVote", clientId: "a", value: "3" },
      { type: "castVote", clientId: "b", value: "8" },
    );
    expect(s.phase).toBe("revealed");
    s = roundReducer(s, { type: "startRound", at: 5000 });
    expect(s.phase).toBe("voting");
    expect(s.votes).toEqual({});
  });
});

describe("castVote", () => {
  it("records a vote and turns the member green without revealing", () => {
    const s = roundReducer(voting("a", "b"), {
      type: "castVote",
      clientId: "a",
      value: "5",
    });
    expect(s.votes).toEqual({ a: "5" });
    expect(s.phase).toBe("voting");
    expect(tableCards(s)).toEqual([
      { clientId: "a", name: "A", voted: true },
      { clientId: "b", name: "B", voted: false },
    ]);
  });

  it("lets a member change their vote while the round runs", () => {
    const s = run(
      voting("a", "b"),
      { type: "castVote", clientId: "a", value: "5" },
      { type: "castVote", clientId: "a", value: "8" },
    );
    expect(s.votes).toEqual({ a: "8" });
  });

  it("ignores votes from members who are not present", () => {
    const s = roundReducer(voting("a"), {
      type: "castVote",
      clientId: "ghost",
      value: "5",
    });
    expect(s.votes).toEqual({});
  });

  it("ignores votes outside the voting phase", () => {
    const idle = initialRound(members("a"));
    expect(
      roundReducer(idle, { type: "castVote", clientId: "a", value: "5" }),
    ).toBe(idle);
  });

  it("reveals as soon as every present member has voted", () => {
    const s = run(
      voting("a", "b"),
      { type: "castVote", clientId: "a", value: "5" },
      { type: "castVote", clientId: "b", value: "8" },
    );
    expect(s.phase).toBe("revealed");
  });
});

describe("withdrawVote", () => {
  it("removes the vote and returns the card to grey", () => {
    const s = run(
      voting("a", "b"),
      { type: "castVote", clientId: "a", value: "5" },
      { type: "withdrawVote", clientId: "a" },
    );
    expect(s.votes).toEqual({});
    expect(tableCards(s)[0].voted).toBe(false);
  });

  it("is a no-op when there was no vote", () => {
    const s = voting("a");
    expect(roundReducer(s, { type: "withdrawVote", clientId: "a" })).toBe(s);
  });
});

describe("presence during a round", () => {
  it("a latecomer joins the running round as an ungreen non-voter", () => {
    // a has voted, x has not, so the round is still open when b arrives.
    const s = run(
      voting("a", "x"),
      { type: "castVote", clientId: "a", value: "5" },
      { type: "memberJoined", member: { clientId: "b", name: "B" } },
    );
    // Still open so the latecomer can vote in the remaining time.
    expect(s.phase).toBe("voting");
    expect(tableCards(s)).toEqual([
      { clientId: "a", name: "A", voted: true },
      { clientId: "x", name: "X", voted: false },
      { clientId: "b", name: "B", voted: false },
    ]);
  });

  it("does not add the same member twice", () => {
    const s = roundReducer(voting("a"), {
      type: "memberJoined",
      member: { clientId: "a", name: "A" },
    });
    expect(s.members).toHaveLength(1);
  });

  it("reveals when the only remaining non-voter leaves", () => {
    const s = run(
      voting("a", "b"),
      { type: "castVote", clientId: "a", value: "5" },
      // b never voted; b leaving completes the round for a.
      { type: "memberLeft", clientId: "b" },
    );
    expect(s.phase).toBe("revealed");
    expect(s.members.map((m) => m.clientId)).toEqual(["a"]);
  });

  it("does not reveal when a voter leaves but a non-voter remains", () => {
    const s = run(
      voting("a", "b", "c"),
      { type: "castVote", clientId: "a", value: "5" },
      { type: "memberLeft", clientId: "a" },
    );
    expect(s.phase).toBe("voting");
  });

  it("drops the departing member's vote", () => {
    const s = run(
      voting("a", "b"),
      { type: "castVote", clientId: "a", value: "5" },
      { type: "memberLeft", clientId: "a" },
    );
    expect(s.votes).toEqual({});
  });

  it("does not reveal an empty table when everyone leaves", () => {
    const s = run(voting("a"), { type: "memberLeft", clientId: "a" });
    expect(s.phase).toBe("voting");
    expect(everyoneVoted(s)).toBe(false);
  });
});

describe("spectator mode", () => {
  it("omits spectators from the table — they have no card", () => {
    const s = roundReducer(voting("a", "b"), {
      type: "setMode",
      clientId: "b",
      mode: "spectator",
    });
    expect(tableCards(s).map((c) => c.clientId)).toEqual(["a"]);
  });

  it("ignores a vote cast by a spectator", () => {
    const s = run(
      voting("a", "b"),
      { type: "setMode", clientId: "b", mode: "spectator" },
      { type: "castVote", clientId: "b", value: "5" },
    );
    expect(s.votes).toEqual({});
  });

  it("reveals when every participant voted, not counting a spectator", () => {
    const s = run(
      voting("a", "b"),
      { type: "setMode", clientId: "b", mode: "spectator" },
      { type: "castVote", clientId: "a", value: "5" },
    );
    expect(s.phase).toBe("revealed");
  });

  it("does not reveal early when everyone present is a spectator", () => {
    const s = roundReducer(voting("a"), {
      type: "setMode",
      clientId: "a",
      mode: "spectator",
    });
    expect(everyoneVoted(s)).toBe(false);
    expect(s.phase).toBe("voting");
    // The timer still ends such a round.
    expect(roundReducer(s, { type: "timeout" }).phase).toBe("revealed");
  });

  it("switching to spectator drops the vote and can complete the round", () => {
    let s = run(voting("a", "b"), { type: "castVote", clientId: "a", value: "5" });
    expect(s.phase).toBe("voting"); // b (a participant) has not voted yet
    s = roundReducer(s, { type: "setMode", clientId: "b", mode: "spectator" });
    expect(s.votes).toEqual({ a: "5" });
    expect(s.phase).toBe("revealed"); // only participant a remains, and it voted
  });

  it("excludes spectators from the revealed votes", () => {
    const s = run(
      voting("a", "b"),
      { type: "castVote", clientId: "a", value: "5" },
      { type: "setMode", clientId: "b", mode: "spectator" },
    );
    expect(revealedVotes(s).map((v) => v.clientId)).toEqual(["a"]);
  });

  it("lets a member join mid-round as a spectator (no card, not counted)", () => {
    let s = roundReducer(voting("a"), {
      type: "memberJoined",
      member: { clientId: "b", name: "B", mode: "spectator" },
    });
    expect(tableCards(s).map((c) => c.clientId)).toEqual(["a"]);
    s = roundReducer(s, { type: "castVote", clientId: "a", value: "5" });
    expect(s.phase).toBe("revealed");
  });

  it("ignores setMode for a member who is not present", () => {
    const s = voting("a");
    expect(
      roundReducer(s, { type: "setMode", clientId: "ghost", mode: "spectator" }),
    ).toBe(s);
  });
});

describe("timeout", () => {
  it("reveals the round even with non-voters", () => {
    const s = run(
      voting("a", "b"),
      { type: "castVote", clientId: "a", value: "5" },
      { type: "timeout" },
    );
    expect(s.phase).toBe("revealed");
  });

  it("is a no-op once already revealed", () => {
    const revealed = run(
      voting("a"),
      { type: "castVote", clientId: "a", value: "5" },
    );
    expect(revealed.phase).toBe("revealed");
    expect(roundReducer(revealed, { type: "timeout" })).toBe(revealed);
  });
});

describe("revealedVotes", () => {
  const withVotes = (
    ids: string[],
    votes: Record<string, DeckValue>,
  ): RoundState => {
    let s = voting(...ids);
    for (const [clientId, value] of Object.entries(votes)) {
      s = roundReducer(s, { type: "castVote", clientId, value });
    }
    return s;
  };

  it("sorts numeric votes ascending", () => {
    const s = withVotes(["a", "b", "c"], { a: "8", b: "1", c: "3" });
    expect(revealedVotes(s).map((v) => v.value)).toEqual(["1", "3", "8"]);
  });

  it("compares numerically, not lexically (100 after 20)", () => {
    const s = withVotes(["a", "b"], { a: "100", b: "20" });
    expect(revealedVotes(s).map((v) => v.value)).toEqual(["20", "100"]);
  });

  it("places `?` after all numbers", () => {
    const s = withVotes(["a", "b"], { a: "?", b: "5" });
    expect(revealedVotes(s).map((v) => v.value)).toEqual(["5", "?"]);
  });

  it("places non-voters (null) last, after `?`", () => {
    let s = withVotes(["a", "b", "c"], { a: "?", b: "5" });
    s = roundReducer(s, { type: "timeout" });
    expect(revealedVotes(s).map((v) => v.value)).toEqual(["5", "?", null]);
  });

  it("keeps roster order among equal values (stable)", () => {
    const s = withVotes(["a", "b", "c"], { a: "5", b: "5", c: "5" });
    expect(revealedVotes(s).map((v) => v.clientId)).toEqual(["a", "b", "c"]);
  });
});

describe("timer", () => {
  it("counts down from the shared start time", () => {
    const s = voting("a");
    expect(remainingMs(s, 1000)).toBe(ROUND_DURATION_MS);
    expect(remainingMs(s, 1000 + 10_000)).toBe(20_000);
  });

  it("clamps remaining time at zero and reports expiry", () => {
    const s = voting("a");
    const later = 1000 + ROUND_DURATION_MS + 5;
    expect(remainingMs(s, later)).toBe(0);
    expect(isExpired(s, later)).toBe(true);
  });

  it("is never expired outside the voting phase", () => {
    const idle = initialRound(members("a"));
    expect(isExpired(idle, 10_000_000)).toBe(false);
    expect(remainingMs(idle, 10_000_000)).toBe(0);
  });
});
