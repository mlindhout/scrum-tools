import { DECK, ROUND_DURATION_MS, type DeckValue } from "../../domain/round";
import type { PokerRound } from "./usePokerRound";

/**
 * The planning-poker table: a shared countdown on top, one card per present
 * Member in the centre (grey = not voted, green = voted, value hidden until
 * Reveal), and the Deck to pick from. Presentational only — all round logic
 * lives in the pure reducer and the `usePokerRound` transport hook.
 */
export function PokerTable({ round }: { round: PokerRound }) {
  const { phase, remainingMs, table, myVote, reveal } = round;
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div aria-live="polite" className="text-sm text-slate-600">
          {phase === "voting" ? (
            <span>
              <span className="font-mono text-lg font-semibold text-slate-900">
                {seconds}s
              </span>{" "}
              remaining
            </span>
          ) : phase === "revealed" ? (
            <span className="font-medium text-slate-900">Revealed</span>
          ) : (
            <span>No round in progress</span>
          )}
        </div>
        <button
          onClick={round.startRound}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          New round
        </button>
      </div>

      {phase === "voting" && (
        <div
          className="h-1 w-full overflow-hidden rounded bg-slate-200"
          role="progressbar"
        >
          <div
            className="h-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
            style={{ width: `${(remainingMs / ROUND_DURATION_MS) * 100}%` }}
          />
        </div>
      )}

      {phase === "revealed" && reveal ? (
        <ul className="flex flex-wrap gap-3">
          {reveal.map((v) => (
            <li
              key={v.clientId}
              className="flex w-20 flex-col items-center gap-1"
            >
              <div
                className={
                  "grid h-24 w-16 place-items-center rounded-lg text-xl font-bold " +
                  (v.value === null
                    ? "bg-slate-100 text-slate-400"
                    : "bg-white shadow ring-1 ring-slate-200 text-slate-900")
                }
              >
                {v.value ?? "—"}
              </div>
              <span className="truncate text-xs text-slate-600">{v.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {table.map((c) => (
            <li
              key={c.clientId}
              className="flex w-20 flex-col items-center gap-1"
            >
              <div
                className={
                  "h-24 w-16 rounded-lg " +
                  (c.voted ? "bg-emerald-500" : "bg-slate-300")
                }
                aria-label={c.voted ? `${c.name} voted` : `${c.name} not voted`}
              />
              <span className="truncate text-xs text-slate-600">{c.name}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {DECK.map((value) => (
          <DeckCard
            key={value}
            value={value}
            selected={myVote === value}
            disabled={phase !== "voting"}
            onPick={() => round.castVote(value)}
          />
        ))}
      </div>
    </div>
  );
}

function DeckCard({
  value,
  selected,
  disabled,
  onPick,
}: {
  value: DeckValue;
  selected: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      aria-pressed={selected}
      className={
        "h-14 w-11 rounded-lg border text-base font-semibold transition " +
        (selected
          ? "border-emerald-600 bg-emerald-500 text-white"
          : "border-slate-300 bg-white text-slate-900 hover:border-slate-500") +
        (disabled ? " cursor-not-allowed opacity-40" : "")
      }
    >
      {value}
    </button>
  );
}
