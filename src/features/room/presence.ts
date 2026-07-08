import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import type { PresentMember } from "../../domain/identity";
import type { Mode } from "../../domain/round";

/**
 * Room-level Presence: every client publishes its `{ clientId, name }` and
 * Supabase syncs the full roster to everyone, including latecomers. The same
 * channel is reused by later slices (poker table state). Vote values never go
 * over Presence — only who is here and whether they've voted (see ADR 0005).
 */

interface PresenceMeta {
  clientId: string;
  name: string;
  mode: Mode;
}

type PresenceState = Record<string, Array<Record<string, unknown>>>;

/** Pure: flatten Supabase presence state into a deduped Member roster. */
export function presentMembersFromState(state: PresenceState): PresentMember[] {
  const seen = new Set<string>();
  const members: PresentMember[] = [];
  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      const { clientId, name, mode } = entry;
      if (typeof clientId !== "string" || typeof name !== "string") continue;
      if (seen.has(clientId)) continue;
      seen.add(clientId);
      members.push({
        clientId,
        name,
        mode: mode === "spectator" ? "spectator" : "participant",
      });
    }
  }
  return members;
}

/**
 * Subscribe to the Room's Presence channel and track the live roster. Pass
 * `self = null` to observe without joining (so a would-be Member can check name
 * uniqueness before committing); pass identity to join and re-track on rename.
 */
export function useRoomPresence(
  roomId: string,
  self: PresenceMeta | null,
): PresentMember[] {
  const [members, setMembers] = useState<PresentMember[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: self?.clientId ?? "observer" } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        setMembers(presentMembersFromState(channel.presenceState()));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && self) {
          void channel.track({
        clientId: self.clientId,
        name: self.name,
        mode: self.mode,
      });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // Re-join only when the room or identity presence key changes; renames are
    // handled by the tracking effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, self?.clientId]);

  useEffect(() => {
    const channel = channelRef.current;
    if (channel && self) {
      void channel.track({
        clientId: self.clientId,
        name: self.name,
        mode: self.mode,
      });
    }
  }, [self?.clientId, self?.name, self?.mode]);

  return members;
}
