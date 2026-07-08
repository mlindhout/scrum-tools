import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { validateRoomName } from "../domain/room";
import { createRoom, fetchRoom } from "../features/room/roomApi";
import {
  clearLastRoomId,
  getLastRoomId,
  setLastRoomId,
} from "../lib/identityStore";

export function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // `?create` means the visitor explicitly wants the landing form (e.g. hit
  // "New Room" from inside a Room), so skip the last-used-Room redirect.
  const forceCreate = searchParams.has("create");
  const [checking, setChecking] = useState(!forceCreate);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Returning visitor: redirect to the last-used Room, or fall back to landing
  // if it no longer exists.
  useEffect(() => {
    if (forceCreate) return;
    const last = getLastRoomId();
    if (!last) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    fetchRoom(last)
      .then((room) => {
        if (cancelled) return;
        if (room) {
          navigate(`/${room.id}`, { replace: true });
        } else {
          clearLastRoomId();
          setChecking(false);
        }
      })
      .catch(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [navigate, forceCreate]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const result = validateRoomName(name);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom(result.name);
      setLastRoomId(room.id);
      navigate(`/${room.id}`);
    } catch {
      setError("Could not create the Room. Please try again.");
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 text-slate-500">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-slate-900">Scrum Tools</h1>
        <p className="mt-2 text-slate-600">
          Planning poker &amp; retrospectives — no account needed. Create a Room
          and share the link.
        </p>
        <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-3">
          <label htmlFor="roomName" className="text-sm font-medium text-slate-700">
            Room name
          </label>
          <input
            id="roomName"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sprint 42"
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create Room"}
          </button>
        </form>
      </div>
    </main>
  );
}
