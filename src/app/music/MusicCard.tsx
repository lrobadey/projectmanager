"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { MUSIC_TIERS, type Album, type MusicTier } from "@/types/db";

function GripIcon() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden>
      <circle cx="3" cy="3" r="1.5" />
      <circle cx="9" cy="3" r="1.5" />
      <circle cx="3" cy="9" r="1.5" />
      <circle cx="9" cy="9" r="1.5" />
      <circle cx="3" cy="15" r="1.5" />
      <circle cx="9" cy="15" r="1.5" />
    </svg>
  );
}

// The score drives the colour of the gauge and its glow: a digital score-meter
// read, green at the top, amber through the middle, rose at the low end.
function ratingTone(rating: number) {
  if (rating >= 8) return { arc: "#34d399", glow: "52, 211, 153" };
  if (rating >= 5) return { arc: "#fbbf24", glow: "251, 191, 36" };
  return { arc: "#fb7185", glow: "251, 113, 133" };
}

/**
 * The bespoke rating graphic for this space: a frosted glass score badge. A
 * conic gauge sweeps around the rim in proportion to the score, glowing in its
 * tier colour, behind a translucent medallion that carries the number / 10.
 * Unrated entries (typically the backlog) show a quiet badge with a music note.
 */
export function RatingBadge({
  rating,
  size = 64,
}: {
  rating: number | null;
  size?: number;
}) {
  const rated = rating !== null;
  const tone = ratingTone(rating ?? 0);
  const pct = (rating ?? 0) / 10;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={rated ? `Rated ${rating} out of 10` : "Not yet rated"}
    >
      {/* Soft tier-coloured glow pooling behind the badge. */}
      {rated && (
        <div
          className="badge-glow absolute inset-0 rounded-full blur-md"
          style={{ background: `rgba(${tone.glow}, 0.45)` }}
        />
      )}

      {/* Conic gauge: the filled sweep in the tier colour, the remainder a faint
          glass track. A masked centre turns the disc into a thin ring. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: rated
            ? `conic-gradient(${tone.arc} ${pct * 360}deg, rgba(255,255,255,0.08) 0deg)`
            : "conic-gradient(rgba(255,255,255,0.12) 0deg, rgba(255,255,255,0.12) 360deg)",
          WebkitMask: "radial-gradient(circle, transparent 62%, #000 63%)",
          mask: "radial-gradient(circle, transparent 62%, #000 63%)",
        }}
      />

      {/* Frosted glass medallion carrying the score. */}
      <div className="glass-nested absolute inset-[7px] flex flex-col items-center justify-center rounded-full">
        {rated ? (
          <>
            <span className="text-lg font-bold leading-none tracking-tight">
              {rating}
            </span>
            <span className="text-[8px] font-medium leading-none text-neutral-400">
              / 10
            </span>
          </>
        ) : (
          <span className="text-base leading-none text-neutral-400">♪</span>
        )}
      </div>
    </div>
  );
}

/* Container looks per surface. `glass` is the frosted, see-through treatment
 * used so the app background reads through every card. */
const CARD_VARIANTS = {
  default:
    "rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
  glass: "glass rounded-3xl",
} as const;

/**
 * Presentational card visuals, shared by the live list and the drag overlay.
 * `handle` and `footer` are injected so the overlay can render a static copy.
 * Bespoke to the music space: the glass score badge anchors the card on the
 * left, with the title, artist, and genre stacked beside it.
 */
export function MusicCardFace({
  album,
  handle,
  footer,
  variant = "default",
}: {
  album: Album;
  handle?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: keyof typeof CARD_VARIANTS;
}) {
  return (
    <div className={`group flex flex-col gap-2 p-3.5 ${CARD_VARIANTS[variant]}`}>
      <div className="flex items-center gap-3">
        {handle}
        <RatingBadge rating={album.rating} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-snug">{album.title}</h3>
          {album.artist && (
            <p className="truncate text-xs italic text-neutral-400">{album.artist}</p>
          )}
          {album.genre && (
            <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              {album.genre}
            </span>
          )}
        </div>
      </div>
      {album.notes && (
        <p className="text-xs leading-relaxed text-neutral-500">{album.notes}</p>
      )}
      {footer}
    </div>
  );
}

export default function MusicCard({
  album,
  onUpdate,
  onDelete,
}: {
  album: Album;
  onUpdate: (fd: FormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [tier, setTier] = useState<MusicTier>(album.tier);
  const {
    setNodeRef,
    setActivatorNodeRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({ id: album.id });

  if (editing) {
    return (
      <div className="glass flex flex-col gap-2 rounded-3xl p-3">
        <form
          action={async (fd) => {
            setEditing(false);
            await onUpdate(fd);
          }}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="id" value={album.id} />
          <input
            name="title"
            defaultValue={album.title}
            placeholder="Album or artist"
            required
            className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <input
            name="artist"
            defaultValue={album.artist ?? ""}
            placeholder="Artist (optional)"
            className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <textarea
            name="notes"
            defaultValue={album.notes ?? ""}
            rows={2}
            placeholder="Misc notes"
            className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <div className="flex gap-2">
            <select
              name="tier"
              value={tier}
              onChange={(e) => setTier(e.target.value as MusicTier)}
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
              defaultValue={album.genre ?? ""}
              placeholder="Genre"
              className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
          </div>
          <input
            name="rating"
            type="number"
            min={0}
            max={10}
            defaultValue={album.rating ?? ""}
            placeholder="Rating out of 10"
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
              onClick={() => setEditing(false)}
              className="rounded px-3 py-1 text-sm text-neutral-500 hover:text-neutral-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      className="transition-opacity"
    >
      <MusicCardFace
        album={album}
        variant="glass"
        handle={
          <button
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            aria-label="Drag to move"
            className="-ml-1 shrink-0 cursor-grab touch-none self-stretch rounded p-0.5 text-neutral-300 transition hover:text-neutral-500 active:cursor-grabbing dark:text-neutral-600 dark:hover:text-neutral-400"
          >
            <GripIcon />
          </button>
        }
        footer={
          <div className="flex gap-3 text-[11px] text-neutral-400 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={() => setEditing(true)}
              className="hover:text-neutral-700"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this entry?")) void onDelete(album.id);
              }}
              className="hover:text-red-600"
            >
              Delete
            </button>
          </div>
        }
      />
    </div>
  );
}
