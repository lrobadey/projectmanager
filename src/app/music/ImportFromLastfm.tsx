"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { importTopAlbums } from "./actions";

/**
 * A small "Import from Last.fm" control: enter a username and pull that
 * profile's most-played albums onto the Listened shelf. The username is
 * remembered in localStorage so you don't retype it. Rendered only when the
 * server has a Last.fm API key configured.
 */
export default function ImportFromLastfm() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Prefill the remembered username (DOM write, not state) and focus on open.
  useEffect(() => {
    if (!open) return;
    const input = inputRef.current;
    if (input && !input.value)
      input.value = localStorage.getItem("lastfm-username") ?? "";
    input?.focus();
  }, [open]);

  function run() {
    const name = (inputRef.current?.value ?? "").trim();
    if (!name) return;
    localStorage.setItem("lastfm-username", name);
    setStatus(null);
    startTransition(async () => {
      const res = await importTopAlbums(name);
      if (res.error) {
        setStatus(res.error);
      } else if (res.imported === 0) {
        setStatus(
          res.skipped > 0 ? "Already up to date — nothing new to add." : "No albums found.",
        );
      } else {
        setStatus(
          `Imported ${res.imported}${res.skipped ? ` · skipped ${res.skipped} already on your shelf` : ""}.`,
        );
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-200 transition active:scale-95"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Import from Last.fm
      </button>
    );
  }

  return (
    <div className="glass flex flex-col gap-2 rounded-2xl p-3 sm:max-w-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
          Import from Last.fm
        </span>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-400 hover:text-neutral-200"
        >
          Close
        </button>
      </div>
      <p className="text-[11px] leading-snug text-neutral-400">
        Pulls a profile&apos;s most-played albums onto the Listened shelf. Rate them
        yourself afterwards — Last.fm has no ratings.
      </p>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Last.fm username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm outline-none placeholder:text-neutral-500 focus:border-white/30"
        />
        <button
          onClick={run}
          disabled={pending}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 transition active:scale-95 disabled:opacity-50"
        >
          {pending ? "Importing…" : "Import"}
        </button>
      </div>
      {status && <p className="text-[11px] text-neutral-300">{status}</p>}
    </div>
  );
}
