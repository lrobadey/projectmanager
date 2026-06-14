"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { GAME_TIERS, type Game, type GameTier } from "@/types/db";
import { GameCardFace } from "./GameCard";
import { createGame, deleteGame, moveGame, updateGame } from "./actions";

const TIER_SHORT: Record<GameTier, string> = {
  playing: "Playing",
  backlog: "Backlog",
  archived: "Archived",
  completed: "Done",
};

const sheetSpring = { type: "spring" as const, stiffness: 320, damping: 32 };
// text-base (16px) keeps iOS from auto-zooming on focus; the focus ring and
// generous padding give the inputs a proper tap target on small screens.
const fieldClass =
  "w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-base text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-white/10";

/* ---------------------------------------------------------------- BottomSheet */

function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // Drag-to-dismiss is bound to the grab handle only (dragListener={false}) so a
  // tap inside the panel isn't misread as a drag and swallow the follow-up click.
  const dragControls = useDragControls();

  // Lock background scroll while a sheet is up.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl border-t border-neutral-200 bg-white pt-2 dark:border-neutral-800 dark:bg-neutral-900"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={sheetSpring}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose();
            }}
          >
            {/* Drag handle — the only region that initiates the dismiss gesture. */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              style={{ touchAction: "none" }}
              className="flex shrink-0 cursor-grab justify-center px-4 py-2 active:cursor-grabbing"
            >
              <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            </div>
            <h2 className="shrink-0 px-4 pb-3 text-base font-semibold">{title}</h2>
            <div
              className="overflow-y-auto overscroll-contain px-4"
              style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------------------------------------------- GameFields */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="px-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function GameFields({
  game,
  defaultTier,
  onSubmit,
  onCancel,
}: {
  game?: Game;
  defaultTier: GameTier;
  onSubmit: (fd: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form action={onSubmit} className="flex flex-col gap-4 pb-2">
      {game && <input type="hidden" name="id" value={game.id} />}
      <Field label="Title">
        <input
          name="title"
          defaultValue={game?.title ?? ""}
          placeholder="Game title"
          autoFocus={!game}
          required
          enterKeyHint="next"
          autoCapitalize="sentences"
          className={fieldClass}
        />
      </Field>
      <Field label="Subtitle">
        <input
          name="subtitle"
          defaultValue={game?.subtitle ?? ""}
          placeholder="Optional one-liner"
          enterKeyHint="next"
          autoCapitalize="sentences"
          className={fieldClass}
        />
      </Field>
      <Field label="Notes">
        <textarea
          name="description"
          defaultValue={game?.description ?? ""}
          placeholder="Optional details"
          rows={4}
          autoCapitalize="sentences"
          className={`${fieldClass} resize-none`}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tier">
          <select name="tier" defaultValue={game?.tier ?? defaultTier} className={fieldClass}>
            {GAME_TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Platform">
          <input
            name="platform"
            defaultValue={game?.platform ?? ""}
            placeholder="PC, PS5, …"
            autoCapitalize="characters"
            className={fieldClass}
          />
        </Field>
      </div>
      <div className="sticky bottom-0 -mx-4 mt-1 flex gap-2 border-t border-neutral-100 bg-white px-4 pb-1 pt-3 dark:border-neutral-800 dark:bg-neutral-900">
        <button
          type="submit"
          className="flex-1 rounded-xl bg-neutral-900 px-4 py-3.5 text-sm font-semibold text-white transition active:scale-[0.98] dark:bg-white dark:text-neutral-900"
        >
          {game ? "Save changes" : "Add game"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-4 py-3.5 text-sm font-medium text-neutral-500 transition active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------------- MobileCard */

function MobileCard({
  game,
  onEdit,
  onMove,
  onDelete,
}: {
  game: Game;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 34 }}
    >
      <GameCardFace
        game={game}
        variant="glass"
        // A tier dot keeps the title/description indentation aligned (matching
        // the desktop drag handle's footprint) without offering a drag affordance.
        handle={
          <span className="mt-1.5 inline-flex h-3 w-3 shrink-0 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          </span>
        }
        footer={
          <div className="mt-2 flex gap-1 pl-6 text-xs font-medium text-neutral-500">
            <button
              onClick={onEdit}
              className="rounded-md px-3 py-1.5 active:bg-neutral-100 dark:active:bg-neutral-800"
            >
              Edit
            </button>
            <button
              onClick={onMove}
              className="rounded-md px-3 py-1.5 active:bg-neutral-100 dark:active:bg-neutral-800"
            >
              Move
            </button>
            <button
              onClick={onDelete}
              className="rounded-md px-3 py-1.5 text-red-500 active:bg-red-50 dark:active:bg-red-950/40"
            >
              Delete
            </button>
          </div>
        }
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------ MobileGameBoard */

export default function MobileGameBoard({ games: initial }: { games: Game[] }) {
  const [games, setGames] = useState(initial);
  const [activeTier, setActiveTier] = useState<GameTier>("playing");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Game | null>(null);
  const [moving, setMoving] = useState<Game | null>(null);

  // Keep local state in sync when the server revalidates (reset-from-props).
  const [syncedFrom, setSyncedFrom] = useState(initial);
  if (syncedFrom !== initial) {
    setSyncedFrom(initial);
    setGames(initial);
  }

  const items = games.filter((g) => g.tier === activeTier);

  async function handleCreate(fd: FormData) {
    setAdding(false);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return;
    const now = new Date().toISOString();
    const tier = (fd.get("tier") as GameTier) || "backlog";
    const temp: Game = {
      id: `temp-${crypto.randomUUID()}`,
      user_id: "",
      title,
      subtitle: String(fd.get("subtitle") ?? "").trim() || null,
      description: String(fd.get("description") ?? "").trim() || null,
      platform: String(fd.get("platform") ?? "").trim() || null,
      tier,
      created_at: now,
      updated_at: now,
    };
    setGames((prev) => [temp, ...prev]);
    await createGame(fd);
  }

  async function handleUpdate(fd: FormData) {
    const id = String(fd.get("id"));
    const patch: Partial<Game> = {
      title: String(fd.get("title")).trim(),
      subtitle: String(fd.get("subtitle") ?? "").trim() || null,
      description: String(fd.get("description")).trim() || null,
      platform: String(fd.get("platform") ?? "").trim() || null,
      tier: fd.get("tier") as GameTier,
    };
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    setEditing(null);
    await updateGame(fd);
  }

  async function handleMove(tier: GameTier) {
    if (!moving) return;
    const id = moving.id;
    setMoving(null);
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, tier } : g)));
    await moveGame(id, tier);
  }

  async function handleDelete(game: Game) {
    if (!confirm("Delete this game?")) return;
    setGames((prev) => prev.filter((g) => g.id !== game.id));
    const fd = new FormData();
    fd.set("id", game.id);
    await deleteGame(fd);
  }

  // One pill button per tier, all four sharing a single row. The active pill
  // carries a single layoutId so it glides between tabs on switch.
  const renderTab = (t: (typeof GAME_TIERS)[number]) => {
    const isActive = t.value === activeTier;
    const count = games.filter((g) => g.tier === t.value).length;
    return (
      <button
        key={t.value}
        onClick={() => setActiveTier(t.value)}
        className="relative flex-1 rounded-full px-1 py-2 text-center"
      >
        {isActive && (
          <motion.span
            layoutId="gameTierPill"
            className="absolute inset-0 rounded-full border border-white/20 bg-white/20 shadow-sm backdrop-blur-md"
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          />
        )}
        <span
          className={`relative z-10 text-xs font-medium ${
            isActive ? "text-white" : "text-neutral-400"
          }`}
        >
          {TIER_SHORT[t.value]}
          <span className="ml-1 text-[10px] opacity-60">{count}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="pb-28">
      {/* Sticky tier switcher: a single row of four pills. */}
      <div
        className="sticky top-0 z-20 -mx-4 mb-4 flex flex-col gap-1 px-4 py-2 backdrop-blur-lg"
        style={{
          backgroundColor: "color-mix(in srgb, var(--background) 60%, transparent)",
        }}
      >
        <div className="glass-pill flex gap-1 rounded-full p-1">
          {GAME_TIERS.map(renderTab)}
        </div>
      </div>

      {/* Card list */}
      <div className="flex flex-col gap-3">
        {/* Key by tier so switching tabs remounts a fresh AnimatePresence:
            with initial={false}, the new tier's cards appear in place instead
            of replaying their "rise from below" entrance. */}
        <AnimatePresence key={activeTier} mode="popLayout" initial={false}>
          {items.map((g) => (
            <MobileCard
              key={g.id}
              game={g}
              onEdit={() => setEditing(g)}
              onMove={() => setMoving(g)}
              onDelete={() => handleDelete(g)}
            />
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="mt-10 text-center text-sm text-neutral-400">
            <p>No games here yet.</p>
            <p className="mt-1">Tap + to add one.</p>
          </div>
        )}
      </div>

      {/* Floating add button */}
      <motion.button
        onClick={() => setAdding(true)}
        whileTap={{ scale: 0.92 }}
        aria-label="Add game"
        className="fixed right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg shadow-black/25 dark:bg-white dark:text-neutral-900"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </motion.button>

      {/* Add sheet */}
      <BottomSheet open={adding} onClose={() => setAdding(false)} title="New game">
        {adding && (
          <GameFields
            defaultTier={activeTier}
            onSubmit={handleCreate}
            onCancel={() => setAdding(false)}
          />
        )}
      </BottomSheet>

      {/* Edit sheet */}
      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit game"
      >
        {editing && (
          <GameFields
            game={editing}
            defaultTier={editing.tier}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        )}
      </BottomSheet>

      {/* Move sheet */}
      <BottomSheet open={moving !== null} onClose={() => setMoving(null)} title="Move to…">
        <div className="flex flex-col gap-2">
          {GAME_TIERS.map((t) => {
            const isCurrent = moving?.tier === t.value;
            return (
              <button
                key={t.value}
                disabled={isCurrent}
                onClick={() => handleMove(t.value)}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm active:scale-[0.99] ${
                  isCurrent
                    ? "border-neutral-200 text-neutral-400 dark:border-neutral-800"
                    : "border-neutral-200 font-medium dark:border-neutral-700"
                }`}
              >
                {t.label}
                {isCurrent && <span className="text-xs">Current</span>}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
