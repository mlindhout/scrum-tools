/**
 * Pure identity helpers for Room membership.
 *
 * A Member is identified by a stable `clientId`; the display name is a label
 * that must be unique among the *currently present* Members. Reconnecting with
 * the same `clientId` reclaims the seat and is never treated as a collision.
 */

import { validateDisplayName } from "./room";

export interface PresentMember {
  clientId: string;
  name: string;
}

const normalize = (name: string): string => name.trim().toLowerCase();

/**
 * Names currently held by present Members other than `selfClientId`,
 * normalized for comparison.
 */
const namesHeldByOthers = (
  present: PresentMember[],
  selfClientId: string,
): Set<string> =>
  new Set(
    present
      .filter((m) => m.clientId !== selfClientId)
      .map((m) => normalize(m.name)),
  );

/**
 * Is `name` already taken by another present Member? A Member re-using their
 * own `clientId` (a reconnect) never collides with themselves.
 */
export function isNameTaken(
  name: string,
  present: PresentMember[],
  selfClientId: string,
): boolean {
  return namesHeldByOthers(present, selfClientId).has(normalize(name));
}

/**
 * The nearest free name for `selfClientId`: the trimmed desired name if free,
 * otherwise the first available `Name (n)` variant starting at `(2)`.
 */
export function suggestName(
  desired: string,
  present: PresentMember[],
  selfClientId: string,
): string {
  const base = desired.trim();
  const taken = namesHeldByOthers(present, selfClientId);
  if (!taken.has(normalize(base))) return base;

  let n = 2;
  let candidate = `${base} (${n})`;
  while (taken.has(normalize(candidate))) {
    n += 1;
    candidate = `${base} (${n})`;
  }
  return candidate;
}

export type NameOutcome =
  | { status: "ok"; name: string }
  | { status: "invalid"; error: string }
  | { status: "taken"; suggestion: string };

/**
 * Resolve a desired display name against the present roster: reject empty names,
 * flag a collision with the nearest free suggestion, or accept the trimmed name.
 * Callers own the messaging for `invalid`/`taken`; only the outcome is shared.
 */
export function resolveDisplayName(
  desired: string,
  present: PresentMember[],
  selfClientId: string,
): NameOutcome {
  const result = validateDisplayName(desired);
  if (!result.ok) return { status: "invalid", error: result.error };
  if (isNameTaken(result.name, present, selfClientId)) {
    return {
      status: "taken",
      suggestion: suggestName(result.name, present, selfClientId),
    };
  }
  return { status: "ok", name: result.name };
}
