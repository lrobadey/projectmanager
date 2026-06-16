"use client";

import { useRef, useState } from "react";
import { MUSIC_TIERS, type MusicTier } from "@/types/db";
import AlbumSearch from "./AlbumSearch";

const empty = { title: "", artist: "", genre: "", image_url: "" };

export default function NewMusicForm({
  defaultTier = "backlog",
  onCreate,
}: {
  defaultTier?: MusicTier;
  onCreate: (fd: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(empty);
  const formRef = useRef<HTMLFormElement>(null);

  function reset() {
    formRef.current?.reset();
    setFields(empty);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-700 dark:border-neutral-700 dark:hover:border-neutral-500"
      >
        + Add entry
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        reset();
        setOpen(false);
        await onCreate(fd);
      }}
      className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
    >
      {/* Search Last.fm as you type; picking a result fills the fields below. */}
      <AlbumSearch
        value={fields.title}
        onValueChange={(title) => setFields((f) => ({ ...f, title }))}
        onPick={(a) =>
          setFields((f) => ({
            ...f,
            title: a.title,
            artist: a.artist,
            genre: a.genre ?? f.genre,
            image_url: a.image ?? f.image_url,
          }))
        }
        placeholder="Search albums or type a name"
        autoFocus
        required
        className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
      />
      <input type="hidden" name="image_url" value={fields.image_url} />
      <input
        name="artist"
        value={fields.artist}
        onChange={(e) => setFields((f) => ({ ...f, artist: e.target.value }))}
        placeholder="Artist (optional)"
        className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
      />
      <textarea
        name="notes"
        placeholder="Misc notes (optional)"
        rows={2}
        className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
      />
      <div className="flex gap-2">
        <select
          name="tier"
          defaultValue={defaultTier}
          className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          {MUSIC_TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          name="genre"
          value={fields.genre}
          onChange={(e) => setFields((f) => ({ ...f, genre: e.target.value }))}
          placeholder="Genre"
          className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      <input
        name="rating"
        type="number"
        min={0}
        max={10}
        placeholder="Rating out of 10 (optional)"
        className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded bg-neutral-900 px-3 py-1 text-sm text-white dark:bg-white dark:text-neutral-900"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded px-3 py-1 text-sm text-neutral-500 hover:text-neutral-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
