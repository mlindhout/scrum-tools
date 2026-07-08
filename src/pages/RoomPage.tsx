import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useIdentity } from "../features/identity/useIdentity";
import { JoinGate } from "../features/room/JoinGate";
import { RoomShell } from "../features/room/RoomShell";
import { useRoomPresence } from "../features/room/presence";
import { fetchRoom, touchRoom, type Room } from "../features/room/roomApi";
import {
  clearLastRoomId,
  getLastRoomId,
  setLastRoomId,
} from "../lib/identityStore";

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; room: Room };

export function RoomPage() {
  const { roomId = "" } = useParams();
  const { clientId, name, setName } = useIdentity();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    setJoined(false);
    fetchRoom(roomId)
      .then((room) => {
        if (cancelled) return;
        if (!room) {
          if (getLastRoomId() === roomId) clearLastRoomId();
          setLoad({ status: "missing" });
          return;
        }
        setLastRoomId(room.id);
        void touchRoom(room.id);
        setLoad({ status: "ready", room });
      })
      .catch(() => !cancelled && setLoad({ status: "missing" }));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // Observe the roster before joining (for the name check); track once joined.
  const roster = useRoomPresence(
    roomId,
    joined && name ? { clientId, name } : null,
  );

  if (load.status === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 text-slate-500">
        <p>Loading…</p>
      </main>
    );
  }

  if (load.status === "missing") {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 px-4 text-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Room not found</h1>
          <p className="mt-2 text-slate-600">
            This Room may have expired or the link is wrong.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
          >
            Go to landing
          </Link>
        </div>
      </main>
    );
  }

  if (!joined || !name) {
    return (
      <JoinGate
        roomName={load.room.name}
        roster={roster}
        clientId={clientId}
        initialName={name ?? ""}
        onJoin={(chosen) => {
          setName(chosen);
          setJoined(true);
        }}
      />
    );
  }

  return (
    <RoomShell
      room={load.room}
      roster={roster}
      clientId={clientId}
      name={name}
      onRename={setName}
    />
  );
}
