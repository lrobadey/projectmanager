"use client";

import { useEffect, useRef, useState } from "react";
import { lookupAlbumDetails, searchAlbums } from "./actions";
import { type LastfmAlbum } from "./types";

const DEBOUNCE_MS = 300;

/**
 * A title input that doubles as a Last.fm album search. As you type it offers
 * matching albums with cover art; picking one fills in the title, artist, cover
 * and (best-effort) genre via `onPick`. If Last.fm isn't configured the search
 * simply returns nothing and this behaves as an ordinary text field.
 */
export default function AlbumSearch({
  value,
  onValueChange,
  onPick,
  name = "title",
  placeholder = "Search albums…",
  autoFocus,
  required,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  onPick: (album: LastfmAlbum) => void;
  name?: string;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
  className?: string;
}) {
  const [results, setResults] = useState<LastfmAlbum[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Bumped on every keystroke so a slow in-flight search can't overwrite the
  // results of a newer one when it finally resolves.
  const reqId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending debounce on unmount.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Search is kicked from the change handler (not an effect) so picking a result
  // — which also updates `value` — never re-triggers a lookup.
  function handleChange(next: string) {
    onValueChange(next);
    if (timer.current) clearTimeout(timer.current);
    const q = next.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    timer.current = setTimeout(async () => {
      const hits = await searchAlbums(q);
      if (id !== reqId.current) return; // a newer keystroke won
      setResults(hits);
      setOpen(hits.length > 0);
      setLoading(false);
    }, DEBOUNCE_MS);
  }

  function choose(album: LastfmAlbum) {
    setOpen(false);
    setResults([]);
    onPick(album);
    // Fill in genre + sharper artwork in the background; ignore failures.
    void lookupAlbumDetails(album.artist, album.title).then((details) => {
      if (details) onPick({ ...album, ...details, image: details.image ?? album.image });
    });
  }

  return (
    <div className="relative">
      <input
        name={name}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={required}
        autoComplete="off"
        className={className}
      />
      {loading && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wide text-neutral-400">
          …
        </span>
      )}
      {open && results.length > 0 && (
        <ul className="glass absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl p-1 shadow-xl">
          {results.map((a, i) => (
            <li key={`${a.title}-${a.artist}-${i}`}>
              {/* onMouseDown (not onClick) so the pick fires before the input's
                  onBlur closes the menu. */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(a);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/10"
              >
                <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-white/10">
                  {a.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{a.title}</span>
                  <span className="block truncate text-xs text-neutral-400">{a.artist}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
