"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  addSubgoal,
  deleteSubgoal,
  reorderSubgoals,
  toggleSubgoal,
  updateSubgoalNotes,
} from "./actions";
import type { Subgoal } from "@/types/db";

type OptimisticAction =
  | { type: "add"; subgoal: Subgoal }
  | { type: "toggle"; id: string; completed: boolean }
  | { type: "notes"; id: string; notes: string | null }
  | { type: "delete"; id: string }
  | { type: "reorder"; ids: string[] };

function reduce(state: Subgoal[], action: OptimisticAction): Subgoal[] {
  switch (action.type) {
    case "add":
      return [...state, action.subgoal];
    case "toggle":
      return state.map((s) =>
        s.id === action.id ? { ...s, completed: action.completed } : s,
      );
    case "notes":
      return state.map((s) =>
        s.id === action.id ? { ...s, notes: action.notes } : s,
      );
    case "delete":
      return state.filter((s) => s.id !== action.id);
    case "reorder":
      return action.ids.map((id) => state.find((s) => s.id === id)!);
  }
}

function ArrowIcon({ up }: { up: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={up ? "" : "rotate-180"}
      aria-hidden
    >
      <path d="M5 8.5V1.5M2 4.5 5 1.5l3 3" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-90" : ""}`}
      aria-hidden
    >
      <path d="M3 1.5 6.5 5 3 8.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------- HeroRow */

function HeroSubgoalRow({
  subgoal,
  index,
  total,
  onToggle,
  onSaveNotes,
  onMove,
  onDelete,
}: {
  subgoal: Subgoal;
  index: number;
  total: number;
  onToggle: (completed: boolean) => void;
  onSaveNotes: (notes: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const teaser = subgoal.notes?.trim();

  function save() {
    const next = textareaRef.current?.value ?? "";
    if (next.trim() !== (subgoal.notes ?? "").trim()) {
      onSaveNotes(next);
    }
    setDirty(false);
  }

  return (
    <div className="glass-nested rounded-2xl px-3 py-2.5">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={subgoal.completed}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Mark "${subgoal.title}" complete`}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-green-500"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <span
              className={`block text-sm font-medium leading-snug ${
                subgoal.completed
                  ? "text-neutral-400 line-through"
                  : "text-neutral-100"
              }`}
            >
              {subgoal.title}
            </span>
            {/* Collapsed: a one-line teaser of the notes so the gist shows
                without opening the editor. */}
            {!open && teaser && (
              <span className="mt-0.5 line-clamp-1 text-xs text-neutral-400">
                {teaser}
              </span>
            )}
          </div>
          <span className="mt-1 shrink-0 text-neutral-400">
            <ChevronIcon open={open} />
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="pl-7 pt-2">
              <textarea
                ref={textareaRef}
                defaultValue={subgoal.notes ?? ""}
                placeholder="Notes for this sub-goal…"
                rows={3}
                onChange={(e) =>
                  setDirty(e.target.value.trim() !== (subgoal.notes ?? "").trim())
                }
                onBlur={save}
                className="w-full resize-y rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm leading-relaxed text-neutral-100 placeholder:text-neutral-500 focus:border-white/25 focus:outline-none"
              />
              <div className="mt-1.5 flex items-center gap-3 text-neutral-400">
                <button
                  type="button"
                  onClick={() => onMove(-1)}
                  disabled={index === 0}
                  aria-label="Move up"
                  className="transition hover:text-neutral-100 disabled:opacity-30 disabled:hover:text-neutral-400"
                >
                  <ArrowIcon up />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(1)}
                  disabled={index === total - 1}
                  aria-label="Move down"
                  className="transition hover:text-neutral-100 disabled:opacity-30 disabled:hover:text-neutral-400"
                >
                  <ArrowIcon up={false} />
                </button>
                {dirty && (
                  <button
                    type="button"
                    onClick={save}
                    className="text-xs font-medium text-blue-400 transition hover:text-blue-300"
                  >
                    Save
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDelete}
                  className="ml-auto text-xs font-medium text-red-400 transition hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------- HeroSubgoalList */

/**
 * The expanded sub-goal experience for hero (primary/secondary/tertiary) cards:
 * each sub-goal is its own glass tile nested inside the larger glass card, with
 * inline notes that tap open to edit and show a one-line teaser when closed.
 */
export default function HeroSubgoalList({
  projectId,
  subgoals,
}: {
  projectId: string;
  subgoals: Subgoal[];
}) {
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [items, applyOptimistic] = useOptimistic(subgoals, reduce);

  const done = items.filter((s) => s.completed).length;
  const total = items.length;

  function handleToggle(id: string, completed: boolean) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id, completed });
      await toggleSubgoal(id, completed);
    });
  }

  function handleSaveNotes(id: string, notes: string) {
    startTransition(async () => {
      applyOptimistic({ type: "notes", id, notes: notes.trim() || null });
      await updateSubgoalNotes(id, notes);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id });
      await deleteSubgoal(id);
    });
  }

  function handleMove(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    startTransition(async () => {
      applyOptimistic({ type: "reorder", ids });
      await reorderSubgoals(ids);
    });
  }

  function handleAdd(fd: FormData) {
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return;
    formRef.current?.reset();
    startTransition(async () => {
      applyOptimistic({
        type: "add",
        subgoal: {
          id: `temp-${crypto.randomUUID()}`,
          project_id: projectId,
          user_id: "",
          title,
          notes: null,
          completed: false,
          position: total,
          created_at: new Date().toISOString(),
        },
      });
      await addSubgoal(fd);
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
          Sub-goals
        </h4>
        {total > 0 && (
          <span className="text-xs text-neutral-400">
            {done} / {total} done
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {items.map((sg, i) => (
          <HeroSubgoalRow
            key={sg.id}
            subgoal={sg}
            index={i}
            total={total}
            onToggle={(completed) => handleToggle(sg.id, completed)}
            onSaveNotes={(notes) => handleSaveNotes(sg.id, notes)}
            onMove={(dir) => handleMove(i, dir)}
            onDelete={() => handleDelete(sg.id)}
          />
        ))}

        <form
          ref={formRef}
          action={handleAdd}
          className="flex items-center gap-2"
        >
          <input type="hidden" name="project_id" value={projectId} />
          <input
            name="title"
            required
            placeholder="Add a sub-goal…"
            className="flex-1 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-white/25 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-neutral-100 transition active:scale-95"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
