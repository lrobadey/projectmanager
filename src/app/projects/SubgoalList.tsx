"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { addSubgoal, deleteSubgoal, toggleSubgoal } from "./actions";
import type { Subgoal } from "@/types/db";

type OptimisticAction =
  | { type: "add"; subgoal: Subgoal }
  | { type: "toggle"; id: string; completed: boolean }
  | { type: "delete"; id: string };

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
  }
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
}: {
  projectId: string;
  subgoals: Subgoal[];
  // When true, the "new sub-goal" input stays hidden until the card is
  // hovered (or the input is focused) — matching the Edit/Delete affordances.
  revealAddOnHover?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Optimistic mirror of the server list: clicks update this instantly while
  // the server action + revalidation run in the background.
  const [items, applyOptimistic] = useOptimistic(subgoals, reduce);

  const done = items.filter((s) => s.completed).length;
  const total = items.length;

  function handleToggle(id: string, completed: boolean) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id, completed });
      await toggleSubgoal(id, completed);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id });
      await deleteSubgoal(id);
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
          completed: false,
          position: total,
          created_at: new Date().toISOString(),
        },
      });
      await addSubgoal(fd);
    });
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

      {open && (
        <div className="mt-1.5 flex flex-col gap-1">
          {items.map((sg) => (
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
              <button
                onClick={() => handleDelete(sg.id)}
                aria-label="Delete sub-goal"
                className="shrink-0 text-[11px] text-neutral-300 opacity-0 transition hover:text-red-600 group-hover/sg:opacity-100"
              >
                ✕
              </button>
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
      )}
    </div>
  );
}
