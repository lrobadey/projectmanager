"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { addProjectLink, deleteProjectLink } from "./actions";
import type { ProjectLink } from "@/types/db";

type OptimisticAction =
  | { type: "add"; link: ProjectLink }
  | { type: "delete"; id: string };

function reduce(state: ProjectLink[], action: OptimisticAction): ProjectLink[] {
  switch (action.type) {
    case "add":
      return [...state, action.link];
    case "delete":
      return state.filter((l) => l.id !== action.id);
  }
}

function LinkIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M6 8a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-1 1" />
      <path d="M8 6a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5l1-1" />
    </svg>
  );
}

// Best-effort label for a link that has no title: show its hostname, falling
// back to the raw string if it somehow isn't parseable.
function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Self-contained source-links slice, mirroring SubgoalList: owns its optimistic
 * list and the add/delete interactions. The card drops this into its footer.
 */
export default function LinkList({
  projectId,
  links,
  revealOnHover = false,
  onAdd,
  onDelete,
}: {
  projectId: string;
  links: ProjectLink[];
  // When true, the chip row + add form stay hidden until the card is hovered
  // (or a field is focused) — matching the Edit/Delete affordances.
  revealOnHover?: boolean;
  // When provided, link changes are lifted into the parent's durable state
  // instead of this component's transient optimistic state. The mobile board
  // needs this: switching tier tabs remounts the card, which would otherwise
  // discard an optimistic add before the server revalidation reaches it.
  onAdd?: (link: ProjectLink) => void;
  onDelete?: (id: string) => void;
}) {
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [items, applyOptimistic] = useOptimistic(links, reduce);

  function handleDelete(id: string) {
    // Lifted mode: update the parent synchronously so the change survives a
    // remount, then persist. Otherwise fall back to local optimistic state.
    if (onDelete) {
      onDelete(id);
      startTransition(() => {
        void deleteProjectLink(id);
      });
      return;
    }
    startTransition(async () => {
      applyOptimistic({ type: "delete", id });
      await deleteProjectLink(id);
    });
  }

  function handleAdd(fd: FormData) {
    const url = String(fd.get("url") ?? "").trim();
    if (!url) return;
    const title = String(fd.get("title") ?? "").trim() || null;
    formRef.current?.reset();
    const link: ProjectLink = {
      id: `temp-${crypto.randomUUID()}`,
      project_id: projectId,
      user_id: "",
      url: /^https?:\/\//i.test(url) ? url : `https://${url}`,
      title,
      position: items.length,
      created_at: new Date().toISOString(),
    };
    if (onAdd) {
      onAdd(link);
      startTransition(() => {
        void addProjectLink(fd);
      });
      return;
    }
    startTransition(async () => {
      applyOptimistic({ type: "add", link });
      await addProjectLink(fd);
    });
  }

  return (
    <div className="pl-6">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((link) => (
            <span
              key={link.id}
              className="group/link inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 py-0.5 pl-2 pr-1 text-[11px] text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-white"
              >
                <LinkIcon />
                <span className="max-w-[12rem] truncate">
                  {link.title || hostLabel(link.url)}
                </span>
              </a>
              <button
                onClick={() => handleDelete(link.id)}
                aria-label="Remove link"
                className="text-neutral-300 opacity-0 transition hover:text-red-600 group-hover/link:opacity-100"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <form
        ref={formRef}
        action={handleAdd}
        className={`mt-1 flex items-center gap-1.5 ${
          revealOnHover
            ? "opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"
            : ""
        }`}
      >
        <input type="hidden" name="project_id" value={projectId} />
        <input
          name="url"
          required
          placeholder="Paste a link…"
          className="min-w-0 flex-1 rounded border border-neutral-200 bg-transparent px-2 py-1 text-xs placeholder:text-neutral-400 dark:border-neutral-700"
        />
        <input
          name="title"
          placeholder="Label (optional)"
          className="w-24 shrink-0 rounded border border-neutral-200 bg-transparent px-2 py-1 text-xs placeholder:text-neutral-400 dark:border-neutral-700"
        />
        <button
          type="submit"
          className="shrink-0 rounded px-2 py-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          Add
        </button>
      </form>
    </div>
  );
}
