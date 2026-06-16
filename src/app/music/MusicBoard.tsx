"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion, useSpring } from "motion/react";
import { MUSIC_TIERS, type Album, type MusicTier } from "@/types/db";
import MusicCard, { MusicCardFace } from "./MusicCard";
import NewMusicForm from "./NewMusicForm";
import { createAlbum, deleteAlbum, moveAlbum, updateAlbum } from "./actions";

function Column({
  tier,
  count,
  children,
}: {
  tier: { value: MusicTier; label: string };
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tier.value });
  // The Listened column is the record shelf: a permanent violet tint sets it
  // apart from the backlog queue, and it glows brighter on drag-over.
  const special = tier.value === "listened";
  const base = special
    ? "bg-violet-950/20 ring-2 ring-violet-800/40 dark:bg-violet-950/30"
    : "ring-2 ring-transparent";
  const over = special
    ? "bg-violet-900/30 ring-2 ring-violet-500/60"
    : "bg-neutral-100 ring-2 ring-neutral-300 dark:bg-neutral-800/40 dark:ring-neutral-700";
  return (
    <section
      ref={setNodeRef}
      className={`flex w-72 shrink-0 snap-start flex-col gap-3 rounded-xl p-2 transition-colors ${
        isOver ? over : base
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <h2
          className={`text-sm font-semibold uppercase tracking-wide ${
            special ? "text-violet-600 dark:text-violet-400" : "text-neutral-500"
          }`}
        >
          {tier.label}
        </h2>
        <span
          className={`text-xs ${
            special ? "text-violet-600/70 dark:text-violet-400/70" : "text-neutral-400"
          }`}
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

export default function MusicBoard({ albums: initial }: { albums: Album[] }) {
  const [albums, setAlbums] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Keep local state in sync when the server revalidates (add/edit/delete/move).
  // Comparing the incoming prop to its previous value during render is React's
  // recommended way to reset state from props — no effect, no extra commit.
  const [syncedFrom, setSyncedFrom] = useState(initial);
  if (syncedFrom !== initial) {
    setSyncedFrom(initial);
    setAlbums(initial);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Physics: card pops on pickup and leans into horizontal velocity, then
  // springs back upright when you stop moving.
  const rotate = useSpring(0, { stiffness: 300, damping: 18, mass: 0.4 });
  const lastX = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = albums.find((a) => a.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    lastX.current = 0;
    rotate.jump(0);
  }

  function onDragMove(e: DragMoveEvent) {
    const dx = e.delta.x - lastX.current;
    lastX.current = e.delta.x;
    rotate.set(Math.max(-14, Math.min(14, dx * 1.1)));
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => rotate.set(0), 90);
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over ? (String(e.over.id) as MusicTier) : null;
    setActiveId(null);
    rotate.set(0);
    if (settle.current) clearTimeout(settle.current);
    if (!overId) return;

    const current = albums.find((a) => a.id === id);
    if (!current || current.tier === overId) return;

    setAlbums((prev) =>
      prev.map((a) => (a.id === id ? { ...a, tier: overId } : a)),
    );
    void moveAlbum(id, overId);
  }

  // Optimistic create/edit/delete: mutate local state immediately, then let
  // the server action + revalidation reconcile in the background.
  async function handleCreate(fd: FormData) {
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return;
    const now = new Date().toISOString();
    const tier = (fd.get("tier") as MusicTier) || "backlog";
    const ratingRaw = String(fd.get("rating") ?? "").trim();
    const temp: Album = {
      id: `temp-${crypto.randomUUID()}`,
      user_id: "",
      title,
      artist: String(fd.get("artist") ?? "").trim() || null,
      genre: String(fd.get("genre") ?? "").trim() || null,
      rating: ratingRaw ? Math.max(0, Math.min(10, Math.round(Number(ratingRaw)))) : null,
      notes: String(fd.get("notes") ?? "").trim() || null,
      tier,
      created_at: now,
      updated_at: now,
    };
    setAlbums((prev) => [temp, ...prev]);
    await createAlbum(fd);
  }

  async function handleUpdate(fd: FormData) {
    const id = String(fd.get("id"));
    const ratingRaw = String(fd.get("rating") ?? "").trim();
    const patch: Partial<Album> = {
      title: String(fd.get("title")).trim(),
      artist: String(fd.get("artist") ?? "").trim() || null,
      genre: String(fd.get("genre") ?? "").trim() || null,
      rating: ratingRaw ? Math.max(0, Math.min(10, Math.round(Number(ratingRaw)))) : null,
      notes: String(fd.get("notes") ?? "").trim() || null,
      tier: fd.get("tier") as MusicTier,
    };
    setAlbums((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    await updateAlbum(fd);
  }

  async function handleDelete(id: string) {
    setAlbums((prev) => prev.filter((a) => a.id !== id));
    const fd = new FormData();
    fd.set("id", id);
    await deleteAlbum(fd);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        rotate.set(0);
      }}
    >
      {/* Two fixed-width columns in a single row that scrolls left/right. */}
      <div className="flex snap-x gap-4 overflow-x-auto pb-4">
        {MUSIC_TIERS.map((tier) => {
          const items = albums.filter((a) => a.tier === tier.value);
          return (
            <Column key={tier.value} tier={tier} count={items.length}>
              {items.map((a) => (
                <MusicCard
                  key={a.id}
                  album={a}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
              <NewMusicForm defaultTier={tier.value} onCreate={handleCreate} />
            </Column>
          );
        })}
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.2,0,0,1)" }}>
        {active ? (
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 520, damping: 17 }}
            style={{ rotate, cursor: "grabbing" }}
            className="shadow-2xl shadow-black/30"
          >
            <MusicCardFace
              album={active}
              variant="glass"
              handle={
                <span className="-ml-1 shrink-0 self-stretch p-0.5 text-neutral-400">
                  <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden>
                    <circle cx="3" cy="3" r="1.5" />
                    <circle cx="9" cy="3" r="1.5" />
                    <circle cx="3" cy="9" r="1.5" />
                    <circle cx="9" cy="9" r="1.5" />
                    <circle cx="3" cy="15" r="1.5" />
                    <circle cx="9" cy="15" r="1.5" />
                  </svg>
                </span>
              }
            />
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
