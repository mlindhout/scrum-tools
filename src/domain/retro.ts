/**
 * Pure retrospective helpers: the three fixed Columns, Card text validation,
 * authorship checks and ordering. The retrospective is persistent (Postgres),
 * but everything here is framework- and Supabase-free so it can be exhaustively
 * unit-tested — the primary test seam (see the PRD Testing Decisions).
 */

import type { ValidationResult } from "./room";

export type ColumnId = "praise" | "start" | "stop";

export interface Column {
  id: ColumnId;
  title: string;
}

/** The three fixed Columns of every Retrospective, in display order. */
export const COLUMNS: readonly Column[] = [
  { id: "praise", title: "Praise" },
  { id: "start", title: "We should start…" },
  { id: "stop", title: "We should stop…" },
] as const;

export const COLUMN_IDS: readonly ColumnId[] = COLUMNS.map((c) => c.id);

export function isColumnId(value: unknown): value is ColumnId {
  return typeof value === "string" && COLUMN_IDS.includes(value as ColumnId);
}

export interface Retrospective {
  id: string;
  roomId: string;
  /** Editable date label, `YYYY-MM-DD`; multiple retros may share a date. */
  date: string;
  locked: boolean;
  createdAt: string;
}

export interface Card {
  id: string;
  retrospectiveId: string;
  column: ColumnId;
  text: string;
  authorClientId: string;
  createdAt: string;
}

/** A single anonymous +1 on a Card, unique per Member (`clientId`). */
export interface CardVote {
  cardId: string;
  clientId: string;
}

/** Whether the given Member has already +1'd the Card. */
export function hasVoted(
  votes: CardVote[],
  cardId: string,
  clientId: string,
): boolean {
  return votes.some((v) => v.cardId === cardId && v.clientId === clientId);
}

/** The total number of +1's on a Card. */
export function voteCount(votes: CardVote[], cardId: string): number {
  return votes.filter((v) => v.cardId === cardId).length;
}

/**
 * Toggle a Member's +1 on a Card, returning the next votes list. Idempotent and
 * one-per-`clientId`: adds the vote if absent, removes it if present, never
 * duplicating. The author of a Card is not special-cased — a Member may +1 their
 * own Card. Does not mutate the input.
 */
export function toggleCardVote(
  votes: CardVote[],
  cardId: string,
  clientId: string,
): CardVote[] {
  if (hasVoted(votes, cardId, clientId)) {
    return votes.filter(
      (v) => !(v.cardId === cardId && v.clientId === clientId),
    );
  }
  return [...votes, { cardId, clientId }];
}

/**
 * A follow-up Action created from a Card but standing alone afterwards: a
 * required description, an optional free-text assignee and a done-toggle. It
 * keeps NO reference to the originating Card (PRD). Any present Member may edit,
 * toggle or delete any Action — there is no authorship check.
 */
export interface Action {
  id: string;
  retrospectiveId: string;
  description: string;
  assignee: string | null;
  done: boolean;
  createdAt: string;
}

const MAX_CARD_LENGTH = 2000;
const MAX_ACTION_LENGTH = 2000;

/** Today's local date as a `YYYY-MM-DD` label — the default for a new Retro. */
export function defaultRetroDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Card text must be non-empty (trimmed) and within the length limit. */
export function validateCardText(raw: string): ValidationResult {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, error: "Card text is required" };
  if (name.length > MAX_CARD_LENGTH)
    return { ok: false, error: "Card text is too long" };
  return { ok: true, name };
}

/** An Action description is required (trimmed) and within the length limit. */
export function validateActionDescription(raw: string): ValidationResult {
  const name = raw.trim();
  if (name.length === 0)
    return { ok: false, error: "Action description is required" };
  if (name.length > MAX_ACTION_LENGTH)
    return { ok: false, error: "Action description is too long" };
  return { ok: true, name };
}

/**
 * Normalise a free-text assignee: trim it, and treat empty/whitespace-only (or
 * a missing value) as no assignee (`null`). The assignee is optional (PRD).
 */
export function normalizeAssignee(
  raw: string | null | undefined,
): string | null {
  const trimmed = (raw ?? "").trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Only the author (by `clientId`) may edit or delete their own Card. */
export function canModifyCard(
  card: Pick<Card, "authorClientId">,
  clientId: string,
): boolean {
  return card.authorClientId === clientId;
}

/** A copy of the retrospectives ordered newest first (by creation time). */
export function sortRetrospectivesNewestFirst(
  retros: Retrospective[],
): Retrospective[] {
  return [...retros].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The Cards belonging to a Column, oldest first (placement order). */
export function cardsInColumn(cards: Card[], column: ColumnId): Card[] {
  return cards
    .filter((c) => c.column === column)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The Actions of a Retrospective, oldest first (creation order). */
export function actionsInRetrospective(
  actions: Action[],
  retrospectiveId: string,
): Action[] {
  return actions
    .filter((a) => a.retrospectiveId === retrospectiveId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
