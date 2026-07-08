import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import type { PresentMember } from "../../domain/identity";
import {
  ROUND_DURATION_MS,
  isParticipant,
  revealedVotes,
  type DeckValue,
  type Mode,
  type RevealedVote,
  type RoundState,
  type TableCard,
} from "../../domain/round";

/**
 * The thin live wiring for a planning-poker Round. The tested truth lives in the
 * pure reducer (`domain/round`); this hook only moves it over Supabase:
 *
 * - Presence (`poker:<id>`) carries each Member's grey/green state and the
 *   round's shared `startedAt`, so a latecomer mid-round sees the correct table
 *   and counts down to the same moment (no Vote values here — see ADR 0005).
 * - Broadcast carries the round lifecycle: `start` restarts everyone's timer;
 *   `reveal` ships the actual Vote values, which only cross the wire at Reveal.
 *
 * The table roster is the room's present Members (passed in), so Members on the
 * retro tab still appear; their absent Vote simply keeps the round open until
 * timeout.
 */

interface Self {
  clientId: string;
  name: string;
  mode: Mode;
}

export interface PokerRound {
  phase: "idle" | "voting" | "revealed";
  remainingMs: number;
  table: TableCard[];
  myVote: DeckValue | null;
  reveal: RevealedVote[] | null;
  /** True when I am a Spectator: no card, no vote, but I still see the table. */
  isSpectator: boolean;
  startRound: () => void;
  castVote: (value: DeckValue) => void;
}

interface PresenceMeta {
  clientId: string;
  voted: boolean;
  startedAt: number | null;
}

const now = (): number => Date.now();

export function usePokerRound(
  roomId: string,
  self: Self,
  roster: PresentMember[],
): PokerRound {
  const channelRef = useRef<RealtimeChannel | null>(null);

  // The round I am currently in (null = idle). Shared via presence + broadcast.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [myVote, setMyVote] = useState<DeckValue | null>(null);
  // Who has voted, from peers' presence (grey/green), keyed by clientId.
  const [votedIds, setVotedIds] = useState<Record<string, boolean>>({});
  // Peers' Vote values, learned only at Reveal via broadcast.
  const [revealValues, setRevealValues] = useState<Record<string, DeckValue>>(
    {},
  );
  const [revealed, setRevealed] = useState(false);
  const [tick, setTick] = useState(0);

  // Keep the latest values reachable from channel callbacks without resubscribe.
  const state = useRef({ startedAt, myVote });
  state.current = { startedAt, myVote };

  const track = useCallback((meta: Partial<PresenceMeta>) => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.track({
      clientId: self.clientId,
      voted: state.current.myVote !== null,
      startedAt: state.current.startedAt,
      ...meta,
    });
    // self intentionally stable via clientId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase.channel(`poker:${roomId}`, {
      config: {
        presence: { key: self.clientId },
        broadcast: { self: true },
      },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const raw = channel.presenceState() as Record<
          string,
          Array<Record<string, unknown>>
        >;
        const voted: Record<string, boolean> = {};
        let peerStartedAt: number | null = null;
        for (const entries of Object.values(raw)) {
          for (const e of entries) {
            if (typeof e.clientId !== "string") continue;
            voted[e.clientId] = e.voted === true;
            if (typeof e.startedAt === "number") {
              peerStartedAt = Math.max(peerStartedAt ?? 0, e.startedAt);
            }
          }
        }
        setVotedIds(voted);
        // Adopt an in-flight round a latecomer walked into.
        if (
          peerStartedAt !== null &&
          peerStartedAt !== state.current.startedAt &&
          peerStartedAt + ROUND_DURATION_MS > now()
        ) {
          setStartedAt(peerStartedAt);
          setRevealed(false);
        }
      })
      .on("broadcast", { event: "start" }, ({ payload }) => {
        const at = (payload as { at: number }).at;
        setStartedAt(at);
        setMyVote(null);
        setRevealValues({});
        setRevealed(false);
        track({ voted: false, startedAt: at });
      })
      .on("broadcast", { event: "reveal" }, ({ payload }) => {
        const { clientId, value } = payload as {
          clientId: string;
          value: DeckValue | null;
        };
        if (value !== null) {
          setRevealValues((prev) => ({ ...prev, [clientId]: value }));
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") track({});
      });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, self.clientId]);

  // 1s heartbeat drives the countdown and the timeout Reveal.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining =
    startedAt === null ? 0 : Math.max(0, startedAt + ROUND_DURATION_MS - now());
  const expired = startedAt !== null && remaining === 0;

  // Reveal fires locally on all-voted or timeout; each client then broadcasts
  // its own value so the full result assembles across the room. Only present
  // Participants are counted, and the all-voted path needs ≥1 of them, so a
  // Spectator-only round waits for the timer (mirrors the pure reducer).
  const participants = roster.filter(isParticipant);
  const everyoneVoted =
    participants.length > 0 &&
    participants.every(
      (m) =>
        votedIds[m.clientId] || (m.clientId === self.clientId && myVote !== null),
    );

  useEffect(() => {
    if (startedAt === null || revealed) return;
    if (expired || everyoneVoted) {
      setRevealed(true);
      channelRef.current?.send({
        type: "broadcast",
        event: "reveal",
        payload: { clientId: self.clientId, value: myVote },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired, everyoneVoted, startedAt, revealed, tick]);

  const startRound = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "start",
      payload: { at: now() },
    });
  }, []);

  const castVote = useCallback(
    (value: DeckValue) => {
      if (startedAt === null || revealed) return;
      if (self.mode === "spectator") return; // Spectators hold no card.
      const next = value === state.current.myVote ? null : value;
      setMyVote(next);
      track({ voted: next !== null });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startedAt, revealed, track, self.mode],
  );

  // Becoming a Spectator drops any card I was holding, so the table and the
  // reveal count no longer include me.
  useEffect(() => {
    if (self.mode === "spectator" && myVote !== null) {
      setMyVote(null);
      track({ voted: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self.mode]);

  const phase: PokerRound["phase"] =
    startedAt === null ? "idle" : revealed ? "revealed" : "voting";

  const table: TableCard[] = roster.filter(isParticipant).map((m) => ({
    clientId: m.clientId,
    name: m.name,
    voted:
      m.clientId === self.clientId ? myVote !== null : votedIds[m.clientId] === true,
  }));

  const reveal = useMemo<RevealedVote[] | null>(() => {
    if (phase !== "revealed") return null;
    const votes: Record<string, DeckValue> = { ...revealValues };
    if (myVote !== null) votes[self.clientId] = myVote;
    const s: RoundState = {
      phase: "revealed",
      startedAt,
      members: roster,
      votes,
    };
    return revealedVotes(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, revealValues, myVote, roster, startedAt]);

  return {
    phase,
    remainingMs: remaining,
    table,
    myVote,
    reveal,
    isSpectator: self.mode === "spectator",
    startRound,
    castVote,
  };
}
