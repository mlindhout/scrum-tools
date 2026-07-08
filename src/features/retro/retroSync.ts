import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

/**
 * Live sync for retrospective data via Supabase Realtime *Broadcast*.
 *
 * The retro tables have no SELECT policy (no enumeration; ADR 0002), so we
 * can't use `postgres_changes`. Instead, after any mutation a client calls
 * `notify()`, which broadcasts a lightweight "changed" event on the Room's
 * retro channel; every other present client receives it and refetches through
 * the capability RPCs. Self-echo is off — the mutating client refetches locally.
 */

const RETRO_CHANGED = "retro-changed";

export function useRetroSync(roomId: string, onChanged: () => void) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const handlerRef = useRef(onChanged);
  handlerRef.current = onChanged;

  useEffect(() => {
    const channel = supabase.channel(`retro:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: RETRO_CHANGED }, () => handlerRef.current())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId]);

  return {
    notify: () => {
      const channel = channelRef.current;
      if (!channel) return;
      void channel.send({
        type: "broadcast",
        event: RETRO_CHANGED,
        payload: {},
      });
    },
  };
}
