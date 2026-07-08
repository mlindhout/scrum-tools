import { nanoid } from "nanoid";

/**
 * Room-level pure helpers: name validation and generation of the unguessable
 * 21-character `nanoid` that is the Room's only capability (see ADR 0002).
 */

export type ValidationResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

const MAX_NAME_LENGTH = 60;

function validate(raw: string, label: string): ValidationResult {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, error: `${label} is required` };
  if (name.length > MAX_NAME_LENGTH)
    return { ok: false, error: `${label} is too long` };
  return { ok: true, name };
}

export function validateRoomName(raw: string): ValidationResult {
  return validate(raw, "Room name");
}

export function validateDisplayName(raw: string): ValidationResult {
  return validate(raw, "Display name");
}

/** A fresh, unguessable Room id — the sole capability granting access. */
export function newRoomId(): string {
  return nanoid();
}

/** A Room is cleaned up after this many days without any activity. */
export const ROOM_INACTIVITY_LIMIT_DAYS = 90;

/**
 * Whether a Room is past its inactivity limit and eligible for cleanup. Mirrors
 * the daily `pg_cron` job (see 0003_lifecycle.sql): a Room expires once its
 * `lastActiveAt` is strictly more than 90 days before `now`. Opening a Room
 * bumps `lastActiveAt`, so a Room in regular use never expires.
 */
export function isRoomExpired(lastActiveAt: Date, now: Date): boolean {
  const ageMs = now.getTime() - lastActiveAt.getTime();
  return ageMs > ROOM_INACTIVITY_LIMIT_DAYS * 24 * 60 * 60 * 1000;
}
