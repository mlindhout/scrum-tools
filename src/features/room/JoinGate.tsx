import { useState } from "react";
import {
  resolveDisplayName,
  suggestName,
  type PresentMember,
} from "../../domain/identity";
import type { Mode } from "../../domain/round";

interface JoinGateProps {
  roomName: string;
  roster: PresentMember[];
  clientId: string;
  initialName: string;
  initialMode: Mode;
  onJoin: (name: string, mode: Mode) => void;
}

export function JoinGate({
  roomName,
  roster,
  clientId,
  initialName,
  initialMode,
  onJoin,
}: JoinGateProps) {
  const [name, setName] = useState(() =>
    suggestName(initialName, roster, clientId),
  );
  const [spectator, setSpectator] = useState(initialMode === "spectator");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const outcome = resolveDisplayName(name, roster, clientId);
    switch (outcome.status) {
      case "invalid":
        setError(outcome.error);
        return;
      case "taken":
        setName(outcome.suggestion);
        setError(`That name is taken here. Try “${outcome.suggestion}”.`);
        return;
      case "ok":
        onJoin(outcome.name, spectator ? "spectator" : "participant");
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <p className="text-sm uppercase tracking-wide text-slate-500">
          Joining
        </p>
        <h1 className="text-2xl font-bold text-slate-900">{roomName}</h1>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <label htmlFor="displayName" className="text-sm font-medium text-slate-700">
            Your name
          </label>
          <input
            id="displayName"
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Marc"
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={spectator}
              onChange={(e) => setSpectator(e.target.checked)}
              className="h-4 w-4"
            />
            Join as spectator (watch only, don’t estimate)
          </label>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
          >
            Enter Room
          </button>
        </form>
      </div>
    </main>
  );
}
