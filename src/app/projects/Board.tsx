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
import {
  TIERS,
  statusForTier,
  type Project,
  type ProjectStatus,
  type ProjectTier,
} from "@/types/db";
import ProjectCard, { CardFace } from "./ProjectCard";
import NewProjectForm from "./NewProjectForm";
import {
  createProject,
  deleteProject,
  moveProject,
  updateProject,
} from "./actions";

function Column({
  tier,
  count,
  children,
}: {
  tier: { value: ProjectTier; label: string };
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tier.value });
  // The Completed column is the trophy shelf: a permanent dark-green tint marks
  // it apart from the working columns, and it glows brighter on drag-over.
  const special = tier.value === "completed";
  const base = special
    ? "bg-emerald-950/20 ring-2 ring-emerald-800/40 dark:bg-emerald-950/30"
    : "ring-2 ring-transparent";
  const over = special
    ? "bg-emerald-900/30 ring-2 ring-emerald-500/60"
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
            special ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500"
          }`}
        >
          {tier.label}
        </h2>
        <span
          className={`text-xs ${
            special ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-neutral-400"
          }`}
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

export default function Board({ projects: initial }: { projects: Project[] }) {
  const [projects, setProjects] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Keep local state in sync when the server revalidates (add/edit/delete/move).
  // Comparing the incoming prop to its previous value during render is React's
  // recommended way to reset state from props — no effect, no extra commit.
  const [syncedFrom, setSyncedFrom] = useState(initial);
  if (syncedFrom !== initial) {
    setSyncedFrom(initial);
    setProjects(initial);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Physics: card pops on pickup and leans into horizontal velocity, then
  // springs back upright when you stop moving.
  const rotate = useSpring(0, { stiffness: 300, damping: 18, mass: 0.4 });
  const lastX = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = projects.find((p) => p.id === activeId) ?? null;

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
    const overId = e.over ? (String(e.over.id) as ProjectTier) : null;
    setActiveId(null);
    rotate.set(0);
    if (settle.current) clearTimeout(settle.current);
    if (!overId) return;

    const current = projects.find((p) => p.id === id);
    if (!current || current.tier === overId) return;

    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              tier: overId,
              status: statusForTier(overId, p.status),
              completed_from_tier:
                overId === "completed"
                  ? p.tier === "completed"
                    ? p.completed_from_tier
                    : p.tier
                  : null,
            }
          : p
      )
    );
    void moveProject(id, overId);
  }

  // Optimistic create/edit/delete: mutate local state immediately, then let
  // the server action + revalidation reconcile in the background.
  async function handleCreate(fd: FormData) {
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return;
    const now = new Date().toISOString();
    const tier = (fd.get("tier") as ProjectTier) || "idea";
    const temp: Project = {
      id: `temp-${crypto.randomUUID()}`,
      user_id: "",
      title,
      description: String(fd.get("description") ?? "").trim() || null,
      tier,
      status: statusForTier(tier, "active"),
      due_date: String(fd.get("due_date") ?? "") || null,
      completed_from_tier: null,
      created_at: now,
      updated_at: now,
      subgoals: [],
    };
    setProjects((prev) => [temp, ...prev]);
    await createProject(fd);
  }

  async function handleUpdate(fd: FormData) {
    const id = String(fd.get("id"));
    const tier = fd.get("tier") as ProjectTier;
    const rawStatus = fd.get("status") as ProjectStatus | null;
    const patch: Partial<Project> = {
      title: String(fd.get("title")).trim(),
      description: String(fd.get("description")).trim() || null,
      tier,
      // Vault items are always "Idea", Completed items "Done"; their status field
      // is hidden, so a missing value means the project just changed columns.
      status: statusForTier(tier, rawStatus ?? "active"),
      due_date: String(fd.get("due_date")) || null,
    };
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              ...patch,
              completed_from_tier:
                tier === "completed"
                  ? p.tier === "completed"
                    ? p.completed_from_tier
                    : p.tier
                  : null,
            }
          : p
      )
    );
    await updateProject(fd);
  }

  async function handleDelete(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    const fd = new FormData();
    fd.set("id", id);
    await deleteProject(fd);
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
      {/* Six fixed-width columns in a single row that scrolls left/right — the
          board grows wider as the Completed shelf fills, rather than cramping. */}
      <div className="flex snap-x gap-4 overflow-x-auto pb-4">
        {TIERS.map((tier) => {
          const items = projects.filter((p) => p.tier === tier.value);
          return (
            <Column key={tier.value} tier={tier} count={items.length}>
              {items.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
              <NewProjectForm defaultTier={tier.value} onCreate={handleCreate} />
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
            <CardFace
              project={active}
              variant="glass"
              handle={
                <span className="-ml-1 mt-0.5 shrink-0 p-0.5 text-neutral-400">
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
