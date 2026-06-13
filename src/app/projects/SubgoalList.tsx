"use client";

import { useState } from "react";
import { addSubgoal, deleteSubgoal, toggleSubgoal } from "./actions";
import type { Subgoal } from "@/types/db";

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
}: {
  projectId: string;
  subgoals: Subgoal[];
}) {
  const [open, setOpen] = useState(false);
  const done = subgoals.filter((s) => s.completed).length;
  const total = subgoals.length;

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
          {subgoals.map((sg) => (
            <div key={sg.id} className="group/sg flex items-center gap-2">
              <input
                type="checkbox"
                checked={sg.completed}
                onChange={(e) => toggleSubgoal(sg.id, e.target.checked)}
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
                onClick={() => deleteSubgoal(sg.id)}
                aria-label="Delete sub-goal"
                className="shrink-0 text-[11px] text-neutral-300 opacity-0 transition hover:text-red-600 group-hover/sg:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}

          <form
            action={async (fd) => {
              await addSubgoal(fd);
            }}
            className="mt-0.5 flex items-center gap-2"
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
