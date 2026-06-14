"use client";

import { useRef, useState } from "react";
import { GAME_TIERS, type GameTier } from "@/types/db";

export default function NewGameForm({
  defaultTier = "backlog",
  onCreate,
}: {
  defaultTier?: GameTier;
  onCreate: (fd: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-700 dark:border-neutral-700 dark:hover:border-neutral-500"
      >
        + Add game
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        formRef.current?.reset();
        setOpen(false);
        await onCreate(fd);
      }}
      className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <input
        name="title"
        placeholder="Game title"
        autoFocus
        required
        className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
      />
      <textarea
        name="description"
        placeholder="Notes (optional)"
        rows={2}
        className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
      />
      <div className="flex gap-2">
        <select
          name="tier"
          defaultValue={defaultTier}
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
          onClick={() => setOpen(false)}
          className="rounded px-3 py-1 text-sm text-neutral-500 hover:text-neutral-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
