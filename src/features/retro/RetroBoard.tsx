import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COLUMNS,
  actionsInRetrospective,
  cardsInColumn,
  canModifyCard,
  defaultRetroDate,
  hasVoted,
  normalizeAssignee,
  sortRetrospectivesNewestFirst,
  validateActionDescription,
  validateCardText,
  voteCount,
  type Action,
  type Card,
  type CardVote,
  type Retrospective,
} from "../../domain/retro";
import {
  addCardVote,
  createAction,
  createCard,
  createRetrospective,
  deleteAction,
  deleteCard,
  listActions,
  listCardVotes,
  listCards,
  listRetrospectives,
  removeCardVote,
  setActionDone,
  updateAction,
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
  const [votes, setVotes] = useState<CardVote[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // The create/edit-action modal; a Card is only the entry point — an Action
  // keeps no reference to it, so we track only the retro and any Action edited.
  const [actionModal, setActionModal] = useState<
    { mode: "create" } | { mode: "edit"; action: Action } | null
  >(null);

  const refresh = useCallback(async () => {
    const [nextRetros, nextCards, nextVotes, nextActions] = await Promise.all([
      listRetrospectives(roomId),
      listCards(roomId),
      listCardVotes(roomId),
      listActions(roomId),
    ]);
    setRetros(sortRetrospectivesNewestFirst(nextRetros));
    setCards(nextCards);
    setVotes(nextVotes);
    setActions(nextActions);
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
            votes={votes}
            onAdd={(text) =>
              mutate(() =>
                createCard(selected.id, column.id, text, clientId),
              )
            }
            onEdit={(id, text) => mutate(() => updateCardText(id, text))}
            onDelete={(id) => mutate(() => deleteCard(id))}
            onToggleVote={(id) =>
              mutate(() =>
                hasVoted(votes, id, clientId)
                  ? removeCardVote(id, clientId)
                  : addCardVote(id, clientId),
              )
            }
            onCreateAction={() => setActionModal({ mode: "create" })}
          />
        ))}
      </div>

      <ActionsList
        actions={actionsInRetrospective(actions, selected.id)}
        onToggleDone={(id, done) => mutate(() => setActionDone(id, done))}
        onEdit={(action) => setActionModal({ mode: "edit", action })}
        onDelete={(id) => mutate(() => deleteAction(id))}
      />

      {actionModal && (
        <ActionModal
          action={actionModal.mode === "edit" ? actionModal.action : null}
          onClose={() => setActionModal(null)}
          onSubmit={async (description, assignee) => {
            await mutate(() =>
              actionModal.mode === "edit"
                ? updateAction(actionModal.action.id, description, assignee)
                : createAction(selected.id, description, assignee),
            );
            setActionModal(null);
          }}
        />
      )}
    </div>
  );
}

function ActionsList({
  actions,
  onToggleDone,
  onEdit,
  onDelete,
}: {
  actions: Action[];
  onToggleDone: (id: string, done: boolean) => Promise<void>;
  onEdit: (action: Action) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="text-sm font-semibold text-slate-700">Actions</h3>
      {actions.length === 0 ? (
        <p className="text-sm text-slate-500">
          No actions yet. Right-click (or long-press) a card to create one.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {actions.map((action) => (
            <li
              key={action.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            >
              <input
                type="checkbox"
                checked={action.done}
                aria-label={action.done ? "Mark not done" : "Mark done"}
                onChange={() => void onToggleDone(action.id, !action.done)}
                className="h-4 w-4"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className={`break-words ${
                    action.done ? "text-slate-400 line-through" : ""
                  }`}
                >
                  {action.description}
                </span>
                {action.assignee && (
                  <span className="text-xs text-slate-500">
                    @{action.assignee}
                  </span>
                )}
              </div>
              <button
                onClick={() => onEdit(action)}
                className="text-xs text-slate-500 underline"
              >
                Edit
              </button>
              <button
                onClick={() => void onDelete(action.id)}
                className="text-xs text-red-600 underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActionModal({
  action,
  onClose,
  onSubmit,
}: {
  action: Action | null;
  onClose: () => void;
  onSubmit: (description: string, assignee: string | null) => Promise<void>;
}) {
  const [description, setDescription] = useState(action?.description ?? "");
  const [assignee, setAssignee] = useState(action?.assignee ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateActionDescription(description);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    void onSubmit(result.name, normalizeAssignee(assignee));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={action ? "Edit action" : "Create action"}
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-white p-4 shadow-xl"
      >
        <h3 className="text-base font-semibold text-slate-800">
          {action ? "Edit action" : "Create action"}
        </h3>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Description
          <textarea
            autoFocus
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setError(null);
            }}
            rows={2}
            placeholder="What needs to happen?"
            className="resize-none rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Assignee (optional)
          <input
            type="text"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="Who owns it?"
            className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
        </label>
        {error && <span className="text-xs text-red-600">{error}</span>}
        <div className="flex justify-end gap-2 text-sm">
          <button type="button" onClick={onClose} className="text-slate-500">
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1 font-medium text-white"
          >
            {action ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ColumnPanel({
  title,
  cards,
  clientId,
  votes,
  onAdd,
  onEdit,
  onDelete,
  onToggleVote,
  onCreateAction,
}: {
  title: string;
  cards: Card[];
  clientId: string;
  votes: CardVote[];
  onAdd: (text: string) => Promise<void>;
  onEdit: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleVote: (id: string) => Promise<void>;
  onCreateAction: () => void;
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
            voteCount={voteCount(votes, card.id)}
            voted={hasVoted(votes, card.id, clientId)}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleVote={onToggleVote}
            onCreateAction={onCreateAction}
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

/**
 * Fire `onLongPress` after a ~500ms touch hold — the mobile fallback for the
 * desktop right-click that opens the create-action modal (a visible icon is the
 * discoverable fallback for both). Any move/end/cancel aborts the pending hold.
 */
function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return {
    onTouchStart: () => {
      clear();
      timer.current = setTimeout(onLongPress, 500);
    },
    onTouchMove: clear,
    onTouchEnd: clear,
    onTouchCancel: clear,
  };
}

function CardItem({
  card,
  mine,
  voteCount,
  voted,
  onEdit,
  onDelete,
  onToggleVote,
  onCreateAction,
}: {
  card: Card;
  mine: boolean;
  voteCount: number;
  voted: boolean;
  onEdit: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleVote: (id: string) => Promise<void>;
  onCreateAction: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.text);
  const [error, setError] = useState<string | null>(null);
  const longPress = useLongPress(onCreateAction);

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
    <li
      onContextMenu={(e) => {
        e.preventDefault();
        onCreateAction();
      }}
      {...longPress}
      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
    >
      <p className="whitespace-pre-wrap break-words">{card.text}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <button
          onClick={() => void onToggleVote(card.id)}
          aria-pressed={voted}
          aria-label={voted ? "Remove your +1" : "Add a +1"}
          className={`rounded-full border px-2 py-0.5 font-medium ${
            voted
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 text-slate-600"
          }`}
        >
          +1 {voteCount}
        </button>
        <button
          onClick={onCreateAction}
          aria-label="Create action"
          title="Create action"
          className="rounded-full border border-slate-300 px-2 py-0.5 font-medium text-slate-600"
        >
          ➤ Action
        </button>
        {mine && (
          <>
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
          </>
        )}
      </div>
    </li>
  );
}
