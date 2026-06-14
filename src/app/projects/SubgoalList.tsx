"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { addSubgoal, deleteSubgoal, reorderSubgoals, toggleSubgoal } from "./actions";
import type { Subgoal } from "@/types/db";

type OptimisticAction =
  | { type: "add"; subgoal: Subgoal }
  | { type: "toggle"; id: string; completed: boolean }
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
    case "delete":
      return state.filter((s) => s.id !== action.id);
    case "reorder":
      return action.ids.map((id) => state.find((s) => s.id === id)!);
  }
}

function ArrowIcon({ up }: { up: boolean }) {
  return (
    <svg
      width="9"
      height="9"
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
      width="10"
      height="10"
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

/**
 * Self-contained sub-goal slice: owns its own expand/collapse state, the
 * "completed / total" marker, and the add/toggle/delete interactions. The card
 * just drops this into its footer — it never touches sub-goal internals.
 */
export default function SubgoalList({
  projectId,
  subgoals,
  revealAddOnHover = false,
  onChange,
}: {
  projectId: string;
  subgoals: Subgoal[];
  // When true, the "new sub-goal" input stays hidden until the card is
  // hovered (or the input is focused) — matching the Edit/Delete affordances.
  revealAddOnHover?: boolean;
  // When provided, sub-goal changes are lifted into the parent's durable state
  // instead of this component's transient optimistic state. The mobile board
  // needs this: switching tier tabs remounts the card, which would otherwise
  // discard an optimistic change before the server revalidation reaches it.
  onChange?: (update: (current: Subgoal[]) => Subgoal[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Optimistic mirror of the server list: clicks update this instantly while
  // the server action + revalidation run in the background.
  const [items, applyOptimistic] = useOptimistic(subgoals, reduce);

  const done = items.filter((s) => s.completed).length;
  const total = items.length;

  // Apply an action either to the parent's durable state (lifted mode, so it
  // survives a remount) or to the local optimistic state, then persist.
  function run(action: OptimisticAction, persist: () => Promise<unknown>) {
    if (onChange) {
      onChange((current) => reduce(current, action));
      startTransition(() => {
        void persist();
      });
    } else {
      startTransition(async () => {
        applyOptimistic(action);
        await persist();
      });
    }
  }

  function handleToggle(id: string, completed: boolean) {
    run({ type: "toggle", id, completed }, () => toggleSubgoal(id, completed));
  }

  function handleDelete(id: string) {
    run({ type: "delete", id }, () => deleteSubgoal(id));
  }

  function handleMove(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run({ type: "reorder", ids }, () => reorderSubgoals(ids));
  }

  function handleAdd(fd: FormData) {
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return;
    formRef.current?.reset();
    const subgoal: Subgoal = {
      id: `temp-${crypto.randomUUID()}`,
      project_id: projectId,
      user_id: "",
      title,
      notes: null,
      completed: false,
      position: total,
      created_at: new Date().toISOString(),
    };
    run({ type: "add", subgoal }, () => addSubgoal(fd));
  }

  return (
    <div className="pl-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-neutral-400 transition hover:text-neutral-600 dark:hover:text-neutral-300"
      >
        <ChevronIcon open={open} />
        <span>
          {total > 0 ? `${done} / ${total} sub-goals` : "Add sub-goals"}
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
        <div className="mt-1.5 flex flex-col gap-1">
          {items.map((sg, i) => (
            <div key={sg.id} className="group/sg flex items-center gap-2">
              <input
                type="checkbox"
                checked={sg.completed}
                onChange={(e) => handleToggle(sg.id, e.target.checked)}
                className="size-3.5 shrink-0 cursor-pointer accent-green-600"
              />
              <span
                className={`flex-1 text-xs ${
                  sg.completed
                    ? "text-neutral-400 line-through"
                    : "text-neutral-600 dark:text-neutral-300"
                }`}
              >
                {sg.title}
              </span>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover/sg:opacity-100">
                <button
                  onClick={() => handleMove(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="text-neutral-300 transition hover:text-neutral-600 disabled:opacity-30 disabled:hover:text-neutral-300 dark:hover:text-neutral-300"
                >
                  <ArrowIcon up />
                </button>
                <button
                  onClick={() => handleMove(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label="Move down"
                  className="text-neutral-300 transition hover:text-neutral-600 disabled:opacity-30 disabled:hover:text-neutral-300 dark:hover:text-neutral-300"
                >
                  <ArrowIcon up={false} />
                </button>
                <button
                  onClick={() => handleDelete(sg.id)}
                  aria-label="Delete sub-goal"
                  className="text-[11px] text-neutral-300 transition hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          <form
            ref={formRef}
            action={handleAdd}
            className={`mt-0.5 flex items-center gap-2 ${
              revealAddOnHover
                ? "opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"
                : ""
            }`}
          >
            <input type="hidden" name="project_id" value={projectId} />
            <input
              name="title"
              required
              placeholder="New sub-goal…"
              className="flex-1 rounded border border-neutral-200 bg-transparent px-2 py-1 text-xs placeholder:text-neutral-400 dark:border-neutral-700"
            />
            <button
              type="submit"
              className="shrink-0 rounded px-2 py-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Add
            </button>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
