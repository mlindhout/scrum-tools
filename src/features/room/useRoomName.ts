import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { renameRoom } from "./roomApi";

/**
 * The live Room name and a way to change it.
 *
 * The name is persisted via the `rename_room` capability RPC and shared with
 * everyone over Supabase Realtime *Broadcast* on a `room-meta:<id>` channel —
 * the same pattern retro uses (see useRetroSync), because the `room` table has
 * no SELECT policy for `postgres_changes` to ride on (ADR 0002). The renamer
 * updates locally and broadcasts; peers pick the new name up from the event.
 */

const ROOM_RENAMED = "room-renamed";

export function useRoomName(roomId: string, initialName: string) {
  const [roomName, setRoomName] = useState(initialName);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Adopt the loaded name when the Room changes (e.g. navigating to another).
  useEffect(() => {
    setRoomName(initialName);
  }, [roomId, initialName]);

  useEffect(() => {
    const channel = supabase.channel(`room-meta:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: ROOM_RENAMED }, ({ payload }) => {
        if (payload && typeof payload.name === "string") {
          setRoomName(payload.name);
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId]);

  async function rename(name: string): Promise<void> {
    setRoomName(name); // optimistic — the RPC re-validates authoritative rules
    await renameRoom(roomId, name);
    void channelRef.current?.send({
      type: "broadcast",
      event: ROOM_RENAMED,
      payload: { name },
    });
  }

  return { roomName, rename };
}
