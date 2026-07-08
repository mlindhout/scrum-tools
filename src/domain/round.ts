/**
 * The pure planning-poker Round model: a reducer `(state, event) → state` plus
 * its derived Reveal condition, table view and sort. This is the primary test
 * seam (PRD Testing Decisions) — no React, no Supabase. The shell wires it to
 * Presence (who is here + grey/green) and Broadcast (round start + reveal
 * values); vote secrecy is a transport concern, so this model holds the full
 * logical truth (see ADR 0005).
 *
 * For this slice every present Member is a Participant; Spectator mode (and a
 * `setMode` event) arrive in a later slice.
 */

/** The fixed voting Deck. `?` means "cannot estimate" and sorts last. */
export const DECK = [
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
] as const;

export type DeckValue = (typeof DECK)[number];

/** How long a Round runs before it reveals on timeout. */
export const ROUND_DURATION_MS = 30_000;

export interface Member {
  clientId: string;
  name: string;
}

export type RoundPhase = "idle" | "voting" | "revealed";

export interface RoundState {
  phase: RoundPhase;
  /** Shared start timestamp so every client counts down to the same moment. */
  startedAt: number | null;
  /** The currently present roster (kept in sync via join/leave events). */
  members: Member[];
  /** Cast votes by clientId. Absent = not (yet) voted. */
  votes: Record<string, DeckValue>;
}

export type RoundEvent =
  | { type: "startRound"; at: number }
  | { type: "castVote"; clientId: string; value: DeckValue }
  | { type: "withdrawVote"; clientId: string }
  | { type: "memberJoined"; member: Member }
  | { type: "memberLeft"; clientId: string }
  | { type: "timeout" };

/** A fresh Round model, optionally seeded with the present roster. */
export function initialRound(members: Member[] = []): RoundState {
  return { phase: "idle", startedAt: null, members, votes: {} };
}

const isPresent = (state: RoundState, clientId: string): boolean =>
  state.members.some((m) => m.clientId === clientId);

/**
 * Should the Round reveal now on the all-voted condition? True only in the
 * voting phase when there is ≥1 present Member and every present Member has
 * cast a vote. (Timeout reveals unconditionally and is handled separately.)
 */
export function everyoneVoted(state: RoundState): boolean {
  if (state.members.length === 0) return false;
  return state.members.every((m) => state.votes[m.clientId] !== undefined);
}

/** Drop a member's vote without mutating the input. */
function withoutVote(
  votes: Record<string, DeckValue>,
  clientId: string,
): Record<string, DeckValue> {
  if (votes[clientId] === undefined) return votes;
  const next = { ...votes };
  delete next[clientId];
  return next;
}

/** Move to the revealed phase if the all-voted condition now holds. */
function maybeReveal(state: RoundState): RoundState {
  if (state.phase === "voting" && everyoneVoted(state)) {
    return { ...state, phase: "revealed" };
  }
  return state;
}

/** The pure Round reducer. Ignores events that don't apply in the phase. */
export function roundReducer(state: RoundState, event: RoundEvent): RoundState {
  switch (event.type) {
    case "startRound":
      return {
        ...state,
        phase: "voting",
        startedAt: event.at,
        votes: {},
      };

    case "castVote": {
      if (state.phase !== "voting") return state;
      if (!isPresent(state, event.clientId)) return state;
      return maybeReveal({
        ...state,
        votes: { ...state.votes, [event.clientId]: event.value },
      });
    }

    case "withdrawVote": {
      if (state.phase !== "voting") return state;
      if (state.votes[event.clientId] === undefined) return state;
      return { ...state, votes: withoutVote(state.votes, event.clientId) };
    }

    case "memberJoined": {
      if (isPresent(state, event.member.clientId)) return state;
      return { ...state, members: [...state.members, event.member] };
    }

    case "memberLeft": {
      if (!isPresent(state, event.clientId)) return state;
      const members = state.members.filter(
        (m) => m.clientId !== event.clientId,
      );
      // Their vote goes with them; the departure may complete the round.
      return maybeReveal({
        ...state,
        members,
        votes: withoutVote(state.votes, event.clientId),
      });
    }

    case "timeout":
      if (state.phase !== "voting") return state;
      return { ...state, phase: "revealed" };
  }
}

export interface TableCard {
  clientId: string;
  name: string;
  /** True once this Member has a vote — green in the UI (value stays hidden). */
  voted: boolean;
}

/** The live table: one card per present Member, in roster order. */
export function tableCards(state: RoundState): TableCard[] {
  return state.members.map((m) => ({
    clientId: m.clientId,
    name: m.name,
    voted: state.votes[m.clientId] !== undefined,
  }));
}

export interface RevealedVote {
  clientId: string;
  name: string;
  /** The chosen Deck value, or null for a non-voter. */
  value: DeckValue | null;
}

/**
 * Sort key: numeric votes ascending first, then `?`, then non-voters. Ties and
 * the two trailing groups keep their roster order (a stable sort).
 */
function revealRank(value: DeckValue | null): [number, number] {
  if (value === null) return [2, 0];
  if (value === "?") return [1, 0];
  return [0, Number(value)];
}

/**
 * The revealed table: every present Member's vote, ascending by value with `?`
 * and non-voters last. Shows the full values (secrecy ends at Reveal).
 */
export function revealedVotes(state: RoundState): RevealedVote[] {
  const rows: RevealedVote[] = state.members.map((m) => ({
    clientId: m.clientId,
    name: m.name,
    value: state.votes[m.clientId] ?? null,
  }));
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const [ta, na] = revealRank(a.row.value);
      const [tb, nb] = revealRank(b.row.value);
      return ta - tb || na - nb || a.index - b.index;
    })
    .map(({ row }) => row);
}

/** Milliseconds left in the current Round, clamped to ≥ 0. */
export function remainingMs(state: RoundState, now: number): number {
  if (state.phase !== "voting" || state.startedAt === null) return 0;
  return Math.max(0, state.startedAt + ROUND_DURATION_MS - now);
}

/** Has the running Round's timer elapsed? Drives the local `timeout` event. */
export function isExpired(state: RoundState, now: number): boolean {
  return state.phase === "voting" && remainingMs(state, now) === 0;
}
