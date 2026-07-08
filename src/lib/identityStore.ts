import { nanoid } from "nanoid";

/**
 * Local-storage backed identity. The `clientId` is generated once per browser
 * and reused across Rooms; the display name is a globally remembered label; the
 * last-used Room drives the returning-visitor redirect.
 */

const CLIENT_ID_KEY = "scrum-tools:clientId";
const NAME_KEY = "scrum-tools:name";
const LAST_ROOM_KEY = "scrum-tools:lastRoom";

/** The stable per-browser `clientId`, generated and persisted on first use. */
export function getOrCreateClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const id = nanoid();
  localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

export function getStoredName(): string | null {
  return localStorage.getItem(NAME_KEY);
}

export function setStoredName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}

export function getLastRoomId(): string | null {
  return localStorage.getItem(LAST_ROOM_KEY);
}

export function setLastRoomId(roomId: string): void {
  localStorage.setItem(LAST_ROOM_KEY, roomId);
}

export function clearLastRoomId(): void {
  localStorage.removeItem(LAST_ROOM_KEY);
}
