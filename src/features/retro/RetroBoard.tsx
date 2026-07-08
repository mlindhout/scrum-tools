import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COLUMNS,
  cardsInColumn,
  canModifyCard,
  defaultRetroDate,
  sortRetrospectivesNewestFirst,
  validateCardText,
  type Card,
  type Retrospective,
} from "../../domain/retro";
import {
  createCard,
  createRetrospective,
  deleteCard,
  listCards,
  listRetrospectives,
  updateCardText,
  updateRetrospectiveDate,
} from "./retroApi";
import { useRetroSync } from "./retroSync";

interface RetroBoardProps {
  roomId: string;
  clientId: string;
}

/**
 * The persistent, live retrospective board. Thin shell over the pure domain
 * helpers and the capability RPCs: it loads the Room's retros/cards, keeps them
 * in sync via Broadcast, and lets any Member create retros/cards while only the
 * author can edit or delete their own Card.
 */
export function RetroBoard({ roomId, clientId }: RetroBoardProps) {
  const [retros, setRetros] = useState<Retrospective[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [nextRetros, nextCards] = await Promise.all([
      listRetrospectives(roomId),
      listCards(roomId),
    ]);
    setRetros(sortRetrospectivesNewestFirst(nextRetros));
    setCards(nextCards);
    setLoading(false);
  }, [roomId]);

  const { notify } = useRetroSync(roomId, () => void refresh());

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  // Keep a valid selection: default to the newest retrospective.
  useEffect(() => {
    if (retros.length === 0) {
      setSelectedId(null);
    } else if (!retros.some((r) => r.id === selectedId)) {
      setSelectedId(retros[0].id);
    }
  }, [retros, selectedId]);

  const selected = useMemo(
    () => retros.find((r) => r.id === selectedId) ?? null,
    [retros, selectedId],
  );

  const mutate = useCallback(
    async (op: () => Promise<unknown>) => {
      await op();
      await refresh();
      notify();
    },
    [refresh, notify],
  );

  async function handleCreateRetro() {
    const date = defaultRetroDate(new Date());
    const id = await createRetrospective(roomId, date);
    await refresh();
    notify();
    setSelectedId(id);
  }

  if (loading) {
    return <p className="text-slate-500">Loading retrospectives…</p>;
  }

  if (retros.length === 0 || !selected) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-700">
          No retrospectives yet
        </h2>
        <p className="mt-1 text-slate-500">
          Start one to begin collecting cards.
        </p>
        <button
          onClick={() => void handleCreateRetro()}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
        >
          New retrospective
        </button>
      </div>
    );
  }

  const selectedCards = cards.filter((c) => c.retrospectiveId === selected.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          Retrospective{" "}
          <select
            aria-label="Choose retrospective"
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
          >
            {retros.map((r) => (
              <option key={r.id} value={r.id}>
                {r.date}
              </option>
            ))}
          </select>
        </label>

        <input
          type="date"
          aria-label="Retrospective date"
          value={selected.date}
          onChange={(e) =>
            void mutate(() =>
              updateRetrospectiveDate(selected.id, e.target.value),
            )
          }
          className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
        />

        <button
          onClick={() => void handleCreateRetro()}
          className="ml-auto rounded-md border border-slate-300 px-3 py-1 text-sm"
        >
          New retrospective
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((column) => (
          <ColumnPanel
            key={column.id}
            title={column.title}
            cards={cardsInColumn(selectedCards, column.id)}
            clientId={clientId}
            onAdd={(text) =>
              mutate(() =>
                createCard(selected.id, column.id, text, clientId),
              )
            }
            onEdit={(id, text) => mutate(() => updateCardText(id, text))}
            onDelete={(id) => mutate(() => deleteCard(id))}
          />
        ))}
      </div>
    </div>
  );
}

function ColumnPanel({
  title,
  cards,
  clientId,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  cards: Card[];
  clientId: string;
  onAdd: (text: string) => Promise<void>;
  onEdit: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateCardText(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft("");
    setError(null);
    void onAdd(result.name);
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>

      <ul className="flex flex-col gap-2">
        {cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            mine={canModifyCard(card, clientId)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>

      <form onSubmit={submit} className="mt-1 flex flex-col gap-1">
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          placeholder="Add a card…"
          rows={2}
          className="resize-none rounded border border-slate-300 px-2 py-1 text-sm"
        />
        {error && <span className="text-xs text-red-600">{error}</span>}
        <button
          type="submit"
          className="self-start rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white"
        >
          Add
        </button>
      </form>
    </section>
  );
}

function CardItem({
  card,
  mine,
  onEdit,
  onDelete,
}: {
  card: Card;
  mine: boolean;
  onEdit: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.text);
  const [error, setError] = useState<string | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const result = validateCardText(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    setError(null);
    void onEdit(card.id, result.name);
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={save} className="flex flex-col gap-1">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            rows={2}
            className="resize-none rounded border border-slate-300 px-2 py-1 text-sm"
          />
          {error && <span className="text-xs text-red-600">{error}</span>}
          <div className="flex gap-2 text-xs">
            <button type="submit" className="font-medium text-slate-900">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(card.text);
                setEditing(false);
                setError(null);
              }}
              className="text-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
      <p className="whitespace-pre-wrap break-words">{card.text}</p>
      {mine && (
        <div className="mt-1 flex gap-2 text-xs">
          <button
            onClick={() => {
              setDraft(card.text);
              setEditing(true);
            }}
            className="text-slate-500 underline"
          >
            Edit
          </button>
          <button
            onClick={() => void onDelete(card.id)}
            className="text-red-600 underline"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
