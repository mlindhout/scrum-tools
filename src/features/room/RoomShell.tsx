import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveDisplayName, type PresentMember } from "../../domain/identity";
import { validateRoomName } from "../../domain/room";
import { PokerTable } from "../poker/PokerTable";
import { usePokerRound } from "../poker/usePokerRound";
import { RetroBoard } from "../retro/RetroBoard";
import { useRoomName } from "./useRoomName";

interface RoomShellProps {
  room: { id: string; name: string };
  roster: PresentMember[];
  clientId: string;
  name: string;
  onRename: (name: string) => void;
}

type Tab = "poker" | "retro";

export function RoomShell({
  room,
  roster,
  clientId,
  name,
  onRename,
}: RoomShellProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("poker");
  // Kept mounted across tabs so every present Member stays on the poker table.
  const round = usePokerRound(room.id, { clientId, name }, roster);
  const { roomName, rename } = useRoomName(room.id, room.name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingRoom, setEditingRoom] = useState(false);
  const [roomDraft, setRoomDraft] = useState(room.name);
  const [roomError, setRoomError] = useState<string | null>(null);

  function saveRoomName(e: React.FormEvent) {
    e.preventDefault();
    const result = validateRoomName(roomDraft);
    if (!result.ok) {
      setRoomError(result.error);
      return;
    }
    void rename(result.name);
    setEditingRoom(false);
    setRoomError(null);
  }

  function saveName(e: React.FormEvent) {
    e.preventDefault();
    const outcome = resolveDisplayName(draft, roster, clientId);
    switch (outcome.status) {
      case "invalid":
        setError(outcome.error);
        return;
      case "taken":
        setDraft(outcome.suggestion);
        setError(`Taken. Try “${outcome.suggestion}”.`);
        return;
      case "ok":
        onRename(outcome.name);
        setEditing(false);
        setError(null);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — no-op; the URL is already in the address bar.
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
          {editingRoom ? (
            <form
              onSubmit={saveRoomName}
              className="mr-auto flex items-center gap-2"
            >
              <input
                autoFocus
                value={roomDraft}
                onChange={(e) => {
                  setRoomDraft(e.target.value);
                  setRoomError(null);
                }}
                className="rounded border border-slate-300 px-2 py-1 text-lg font-bold"
                aria-label="Room name"
              />
              <button type="submit" className="text-sm font-medium">
                Save
              </button>
              {roomError && (
                <span className="text-sm text-red-600">{roomError}</span>
              )}
            </form>
          ) : (
            <div className="mr-auto flex items-center gap-2">
              <h1 className="text-lg font-bold">{roomName}</h1>
              <button
                onClick={() => {
                  setRoomDraft(roomName);
                  setEditingRoom(true);
                }}
                className="text-sm text-slate-500 underline"
              >
                Rename
              </button>
            </div>
          )}
          <button
            onClick={share}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm"
          >
            {copied ? "Link copied" : "Share link"}
          </button>
          <button
            onClick={() => navigate("/?create=1")}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm"
          >
            New Room
          </button>
        </div>
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 pb-2 text-sm text-slate-600">
          {editing ? (
            <form onSubmit={saveName} className="flex items-center gap-2">
              <input
                autoFocus
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError(null);
                }}
                className="rounded border border-slate-300 px-2 py-0.5"
              />
              <button type="submit" className="font-medium text-slate-900">
                Save
              </button>
              {error && <span className="text-red-600">{error}</span>}
            </form>
          ) : (
            <>
              <span>
                You are <strong className="text-slate-900">{name}</strong>
              </span>
              <button
                onClick={() => {
                  setDraft(name);
                  setEditing(true);
                }}
                className="underline"
              >
                Rename
              </button>
            </>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4">
        <nav className="flex gap-1 border-b border-slate-200" role="tablist">
          <TabButton active={tab === "poker"} onClick={() => setTab("poker")}>
            Planning poker
          </TabButton>
          <TabButton active={tab === "retro"} onClick={() => setTab("retro")}>
            Retrospective
          </TabButton>
        </nav>

        <section className="py-8" role="tabpanel">
          {tab === "poker" ? (
            <PokerTable round={round} />
          ) : (
            <RetroBoard roomId={room.id} clientId={clientId} />
          )}
        </section>

        <aside className="pb-8 text-sm text-slate-500">
          Present: {roster.map((m) => m.name).join(", ") || "just you"}
        </aside>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "px-4 py-2 text-sm font-medium " +
        (active
          ? "border-b-2 border-slate-900 text-slate-900"
          : "text-slate-500")
      }
    >
      {children}
    </button>
  );
}
