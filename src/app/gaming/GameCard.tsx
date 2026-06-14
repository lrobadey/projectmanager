"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { GAME_TIERS, type Game, type GameTier } from "@/types/db";

function GripIcon() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden>
      <circle cx="3" cy="3" r="1.5" />
      <circle cx="9" cy="3" r="1.5" />
      <circle cx="3" cy="9" r="1.5" />
      <circle cx="9" cy="9" r="1.5" />
      <circle cx="3" cy="15" r="1.5" />
      <circle cx="9" cy="15" r="1.5" />
    </svg>
  );
}

/* Container looks per surface. `glass` is the frosted, see-through treatment
 * used so the app background reads through every card. */
const CARD_VARIANTS = {
  default:
    "rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
  glass: "glass rounded-3xl",
} as const;

/**
 * Presentational card visuals, shared by the live list and the drag overlay.
 * `handle` and `footer` are injected so the overlay can render a static copy.
 */
export function GameCardFace({
  game,
  handle,
  footer,
  variant = "default",
}: {
  game: Game;
  handle?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: keyof typeof CARD_VARIANTS;
}) {
  return (
    <div className={`group flex flex-col gap-1 p-3 ${CARD_VARIANTS[variant]}`}>
      <div className="flex items-start gap-2">
        {handle}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-snug">{game.title}</h3>
          {game.subtitle && (
            <p className="text-xs italic text-neutral-400">{game.subtitle}</p>
          )}
        </div>
        {game.platform && (
          <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            {game.platform}
          </span>
        )}
      </div>
      {game.description && (
        <p className="pl-6 text-xs text-neutral-500">{game.description}</p>
      )}
      {footer}
    </div>
  );
}

export default function GameCard({
  game,
  onUpdate,
  onDelete,
}: {
  game: Game;
  onUpdate: (fd: FormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [tier, setTier] = useState<GameTier>(game.tier);
  const {
    setNodeRef,
    setActivatorNodeRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({ id: game.id });

  if (editing) {
    return (
      <div className="glass flex flex-col gap-2 rounded-3xl p-3">
        <form
          action={async (fd) => {
            setEditing(false);
            await onUpdate(fd);
          }}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="id" value={game.id} />
          <input
            name="title"
            defaultValue={game.title}
            required
            className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <input
            name="subtitle"
            defaultValue={game.subtitle ?? ""}
            placeholder="Subtitle (optional)"
            className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <textarea
            name="description"
            defaultValue={game.description ?? ""}
            rows={2}
            placeholder="Notes"
            className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <div className="flex gap-2">
            <select
              name="tier"
              value={tier}
              onChange={(e) => setTier(e.target.value as GameTier)}
              className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              {GAME_TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              name="platform"
              defaultValue={game.platform ?? ""}
              placeholder="Platform"
              className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded bg-neutral-900 px-3 py-1 text-sm text-white dark:bg-white dark:text-neutral-900"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded px-3 py-1 text-sm text-neutral-500 hover:text-neutral-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      className="transition-opacity"
    >
      <GameCardFace
        game={game}
        variant="glass"
        handle={
          <button
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            aria-label="Drag to move"
            className="-ml-1 mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-neutral-300 transition hover:text-neutral-500 active:cursor-grabbing dark:text-neutral-600 dark:hover:text-neutral-400"
          >
            <GripIcon />
          </button>
        }
        footer={
          <div className="mt-1 flex gap-3 pl-6 text-[11px] text-neutral-400 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={() => setEditing(true)}
              className="hover:text-neutral-700"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this game?")) void onDelete(game.id);
              }}
              className="hover:text-red-600"
            >
              Delete
            </button>
          </div>
        }
      />
    </div>
  );
}
