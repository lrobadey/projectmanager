"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import {
  MUSIC_TIERS,
  sortAlbums,
  type Album,
  type MusicSort,
  type MusicTier,
} from "@/types/db";
import { MusicCardFace } from "./MusicCard";
import AlbumSearch from "./AlbumSearch";
import SortControl from "./SortControl";
import ImportFromLastfm from "./ImportFromLastfm";
import { createAlbum, deleteAlbum, moveAlbum, updateAlbum } from "./actions";

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

/* --------------------------------------------------------------- MusicFields */

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

function MusicFields({
  album,
  defaultTier,
  onSubmit,
  onCancel,
}: {
  album?: Album;
  defaultTier: MusicTier;
  onSubmit: (fd: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState({
    title: album?.title ?? "",
    artist: album?.artist ?? "",
    genre: album?.genre ?? "",
    image_url: album?.image_url ?? "",
  });

  return (
    <form action={onSubmit} className="flex flex-col gap-4 pb-2">
      {album && <input type="hidden" name="id" value={album.id} />}
      <input type="hidden" name="image_url" value={fields.image_url} />
      <Field label="Album or artist">
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
          placeholder="Search Last.fm or type a name"
          autoFocus={!album}
          required
          className={fieldClass}
        />
      </Field>
      <Field label="Artist">
        <input
          name="artist"
          value={fields.artist}
          onChange={(e) => setFields((f) => ({ ...f, artist: e.target.value }))}
          placeholder="Who made it?"
          enterKeyHint="next"
          autoCapitalize="words"
          className={fieldClass}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tier">
          <select name="tier" defaultValue={album?.tier ?? defaultTier} className={fieldClass}>
            {MUSIC_TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Genre">
          <input
            name="genre"
            value={fields.genre}
            onChange={(e) => setFields((f) => ({ ...f, genre: e.target.value }))}
            placeholder="Jazz, Hip-Hop, …"
            autoCapitalize="words"
            className={fieldClass}
          />
        </Field>
      </div>
      <Field label="Rating (out of 10)">
        <input
          name="rating"
          type="number"
          inputMode="numeric"
          min={0}
          max={10}
          defaultValue={album?.rating ?? ""}
          placeholder="Leave blank if unrated"
          className={fieldClass}
        />
      </Field>
      <Field label="Misc notes">
        <textarea
          name="notes"
          defaultValue={album?.notes ?? ""}
          placeholder="Favourite tracks, where you heard it, …"
          rows={4}
          autoCapitalize="sentences"
          className={`${fieldClass} resize-none`}
        />
      </Field>
      <div className="sticky bottom-0 -mx-4 mt-1 flex gap-2 border-t border-neutral-100 bg-white px-4 pb-1 pt-3 dark:border-neutral-800 dark:bg-neutral-900">
        <button
          type="submit"
          className="flex-1 rounded-xl bg-neutral-900 px-4 py-3.5 text-sm font-semibold text-white transition active:scale-[0.98] dark:bg-white dark:text-neutral-900"
        >
          {album ? "Save changes" : "Add entry"}
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
  album,
  onEdit,
  onMove,
  onDelete,
}: {
  album: Album;
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
      <MusicCardFace
        album={album}
        variant="glass"
        footer={
          <div className="flex gap-1 text-xs font-medium text-neutral-500">
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

/* ----------------------------------------------------------- MobileMusicBoard */

export default function MobileMusicBoard({
  albums: initial,
  lastfmEnabled = false,
}: {
  albums: Album[];
  lastfmEnabled?: boolean;
}) {
  const [albums, setAlbums] = useState(initial);
  const [activeTier, setActiveTier] = useState<MusicTier>("listened");
  const [sort, setSort] = useState<MusicSort>("added");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Album | null>(null);
  const [moving, setMoving] = useState<Album | null>(null);

  // Keep local state in sync when the server revalidates (reset-from-props).
  const [syncedFrom, setSyncedFrom] = useState(initial);
  if (syncedFrom !== initial) {
    setSyncedFrom(initial);
    setAlbums(initial);
  }

  const items = sortAlbums(
    albums.filter((a) => a.tier === activeTier),
    sort,
  );

  function parseRating(fd: FormData): number | null {
    const raw = String(fd.get("rating") ?? "").trim();
    if (!raw) return null;
    const n = Math.round(Number(raw));
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(10, n));
  }

  async function handleCreate(fd: FormData) {
    setAdding(false);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return;
    const now = new Date().toISOString();
    const tier = (fd.get("tier") as MusicTier) || "backlog";
    const temp: Album = {
      id: `temp-${crypto.randomUUID()}`,
      user_id: "",
      title,
      artist: String(fd.get("artist") ?? "").trim() || null,
      genre: String(fd.get("genre") ?? "").trim() || null,
      rating: parseRating(fd),
      notes: String(fd.get("notes") ?? "").trim() || null,
      image_url: String(fd.get("image_url") ?? "").trim() || null,
      playcount: null,
      last_played_at: null,
      tier,
      created_at: now,
      updated_at: now,
    };
    setAlbums((prev) => [temp, ...prev]);
    await createAlbum(fd);
  }

  async function handleUpdate(fd: FormData) {
    const id = String(fd.get("id"));
    const patch: Partial<Album> = {
      title: String(fd.get("title")).trim(),
      artist: String(fd.get("artist") ?? "").trim() || null,
      genre: String(fd.get("genre") ?? "").trim() || null,
      rating: parseRating(fd),
      notes: String(fd.get("notes") ?? "").trim() || null,
      tier: fd.get("tier") as MusicTier,
    };
    if (fd.has("image_url"))
      patch.image_url = String(fd.get("image_url")).trim() || null;
    setAlbums((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setEditing(null);
    await updateAlbum(fd);
  }

  async function handleMove(tier: MusicTier) {
    if (!moving) return;
    const id = moving.id;
    setMoving(null);
    setAlbums((prev) => prev.map((a) => (a.id === id ? { ...a, tier } : a)));
    await moveAlbum(id, tier);
  }

  async function handleDelete(album: Album) {
    if (!confirm("Delete this entry?")) return;
    setAlbums((prev) => prev.filter((a) => a.id !== album.id));
    const fd = new FormData();
    fd.set("id", album.id);
    await deleteAlbum(fd);
  }

  // One pill button per tier, sharing a single row. The active pill carries a
  // single layoutId so it glides between tabs on switch.
  const renderTab = (t: (typeof MUSIC_TIERS)[number]) => {
    const isActive = t.value === activeTier;
    const count = albums.filter((a) => a.tier === t.value).length;
    return (
      <button
        key={t.value}
        onClick={() => setActiveTier(t.value)}
        className="relative flex-1 rounded-full px-1 py-2 text-center"
      >
        {isActive && (
          <motion.span
            layoutId="musicTierPill"
            className="absolute inset-0 rounded-full border border-white/20 bg-white/20 shadow-sm backdrop-blur-md"
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          />
        )}
        <span
          className={`relative z-10 text-xs font-medium ${
            isActive ? "text-white" : "text-neutral-400"
          }`}
        >
          {t.label}
          <span className="ml-1 text-[10px] opacity-60">{count}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="pb-28">
      {/* Sticky tier switcher: a single row of pills. */}
      <div
        className="sticky top-0 z-20 -mx-4 mb-4 flex flex-col gap-1 px-4 py-2 backdrop-blur-lg"
        style={{
          backgroundColor: "color-mix(in srgb, var(--background) 60%, transparent)",
        }}
      >
        <div className="glass-pill flex gap-1 rounded-full p-1">
          {MUSIC_TIERS.map(renderTab)}
        </div>
        <div className="flex items-center justify-between gap-2 overflow-x-auto pt-1">
          <SortControl value={sort} onChange={setSort} />
          {lastfmEnabled && <ImportFromLastfm />}
        </div>
      </div>

      {/* Card list */}
      <div className="flex flex-col gap-3">
        {/* Key by tier so switching tabs remounts a fresh AnimatePresence:
            with initial={false}, the new tier's cards appear in place instead
            of replaying their "rise from below" entrance. */}
        <AnimatePresence key={activeTier} mode="popLayout" initial={false}>
          {items.map((a) => (
            <MobileCard
              key={a.id}
              album={a}
              onEdit={() => setEditing(a)}
              onMove={() => setMoving(a)}
              onDelete={() => handleDelete(a)}
            />
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="mt-10 text-center text-sm text-neutral-400">
            <p>Nothing here yet.</p>
            <p className="mt-1">Tap + to add an album or artist.</p>
          </div>
        )}
      </div>

      {/* Floating add button */}
      <motion.button
        onClick={() => setAdding(true)}
        whileTap={{ scale: 0.92 }}
        aria-label="Add entry"
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
      <BottomSheet open={adding} onClose={() => setAdding(false)} title="New entry">
        {adding && (
          <MusicFields
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
        title="Edit entry"
      >
        {editing && (
          <MusicFields
            album={editing}
            defaultTier={editing.tier}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        )}
      </BottomSheet>

      {/* Move sheet */}
      <BottomSheet open={moving !== null} onClose={() => setMoving(null)} title="Move to…">
        <div className="flex flex-col gap-2">
          {MUSIC_TIERS.map((t) => {
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
