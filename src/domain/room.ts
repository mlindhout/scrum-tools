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
