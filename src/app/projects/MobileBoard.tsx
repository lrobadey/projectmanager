"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  STATUSES,
  TIERS,
  statusForTier,
  type Project,
  type ProjectStatus,
  type ProjectTier,
} from "@/types/db";
import { CardFace } from "./ProjectCard";
import SubgoalList from "./SubgoalList";
import LinkList from "./LinkList";
import {
  createProject,
  deleteProject,
  moveProject,
  updateProject,
} from "./actions";

const TIER_SHORT: Record<ProjectTier, string> = {
  primary: "Primary",
  secondary: "Second.",
  tertiary: "Third",
  incubating: "Incubating",
  idea: "Ideas",
  completed: "Done",
};

// Two-tier tab hierarchy: the active priorities ride the top row, while the
// "not yet" buckets (incubating + the idea vault) and the finished pile
// (completed) sit on a second row.
const TOP_TIERS = TIERS.filter(
  (t) => t.value === "primary" || t.value === "secondary" || t.value === "tertiary",
);
const BOTTOM_TIERS = TIERS.filter(
  (t) =>
    t.value === "incubating" || t.value === "idea" || t.value === "completed",
);

const sheetSpring = { type: "spring" as const, stiffness: 320, damping: 32 };
const fieldClass =
  "rounded-lg border border-neutral-200 px-3 py-2.5 text-base dark:border-neutral-700 dark:bg-neutral-950";

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
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-neutral-200 bg-white px-4 pt-3 dark:border-neutral-800 dark:bg-neutral-900"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={sheetSpring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose();
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <h2 className="mb-3 text-base font-semibold">{title}</h2>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------- ProjectFields */

function ProjectFields({
  project,
  defaultTier,
  onSubmit,
  onCancel,
}: {
  project?: Project;
  defaultTier: ProjectTier;
  onSubmit: (fd: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  // Track tier live so the status control disappears for Idea Vault projects.
  const [tier, setTier] = useState<ProjectTier>(project?.tier ?? defaultTier);
  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      {project && <input type="hidden" name="id" value={project.id} />}
      <input
        name="title"
        defaultValue={project?.title ?? ""}
        placeholder="Project title"
        autoFocus
        required
        className={fieldClass}
      />
      <textarea
        name="description"
        defaultValue={project?.description ?? ""}
        placeholder="Notes (optional)"
        rows={3}
        className={fieldClass}
      />
      <select
        name="tier"
        value={tier}
        onChange={(e) => setTier(e.target.value as ProjectTier)}
        className={fieldClass}
      >
        {TIERS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {project && tier !== "idea" && tier !== "completed" && (
        <select
          name="status"
          defaultValue={project.status === "idea" ? "active" : project.status}
          className={fieldClass}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}
      <input
        name="due_date"
        type="date"
        defaultValue={project?.due_date ?? ""}
        className={fieldClass}
      />
      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white active:scale-[0.98] dark:bg-white dark:text-neutral-900"
        >
          {project ? "Save changes" : "Add project"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-3 text-sm font-medium text-neutral-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------------- MobileCard */

function MobileCard({
  project,
  onEdit,
  onMove,
  onDelete,
}: {
  project: Project;
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
      <CardFace
        project={project}
        variant="glass"
        // A tier dot keeps the title/description indentation aligned (matching
        // the desktop drag handle's footprint) without offering a drag affordance.
        handle={
          <span className="mt-1.5 inline-flex h-3 w-3 shrink-0 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          </span>
        }
        footer={
          <>
            <div className="mt-1.5">
              <SubgoalList
                projectId={project.id}
                subgoals={project.subgoals ?? []}
              />
            </div>
            <div className="mt-1.5">
              <LinkList projectId={project.id} links={project.links ?? []} />
            </div>
          <div className="mt-2 flex gap-1 pl-6 text-xs font-medium text-neutral-500">
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
          </>
        }
      />
    </motion.div>
  );
}

/* ---------------------------------------------------------------- MobileBoard */

export default function MobileBoard({ projects: initial }: { projects: Project[] }) {
  const [projects, setProjects] = useState(initial);
  const [activeTier, setActiveTier] = useState<ProjectTier>("primary");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [moving, setMoving] = useState<Project | null>(null);

  // Keep local state in sync when the server revalidates. Comparing the prop to
  // its previous value during render is React's recommended reset-from-props
  // pattern — no effect, no extra commit.
  const [syncedFrom, setSyncedFrom] = useState(initial);
  if (syncedFrom !== initial) {
    setSyncedFrom(initial);
    setProjects(initial);
  }

  const items = projects.filter((p) => p.tier === activeTier);

  async function handleCreate(fd: FormData) {
    setAdding(false);
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
    const patch = {
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
          : p,
      ),
    );
    setEditing(null);
    await updateProject(fd);
  }

  async function handleMove(tier: ProjectTier) {
    if (!moving) return;
    const id = moving.id;
    setMoving(null);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              tier,
              status: statusForTier(tier, p.status),
              completed_from_tier:
                tier === "completed"
                  ? p.tier === "completed"
                    ? p.completed_from_tier
                    : p.tier
                  : null,
            }
          : p,
      ),
    );
    await moveProject(id, tier);
  }

  async function handleDelete(project: Project) {
    if (!confirm("Delete this project?")) return;
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
    const fd = new FormData();
    fd.set("id", project.id);
    await deleteProject(fd);
  }

  // One pill button per tier. Shared between the two rows of the switcher; the
  // active pill carries a single layoutId so it glides between rows on switch.
  const renderTab = (t: (typeof TIERS)[number]) => {
    const isActive = t.value === activeTier;
    const count = projects.filter((p) => p.tier === t.value).length;
    return (
      <button
        key={t.value}
        onClick={() => setActiveTier(t.value)}
        className="relative flex-1 rounded-full px-1 py-2 text-center"
      >
        {isActive && (
          <motion.span
            layoutId="tierPill"
            className="absolute inset-0 rounded-full border border-white/20 bg-white/20 shadow-sm backdrop-blur-md"
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          />
        )}
        <span
          className={`relative z-10 text-xs font-medium ${
            isActive ? "text-white" : "text-neutral-400"
          }`}
        >
          {TIER_SHORT[t.value]}
          <span className="ml-1 text-[10px] opacity-60">{count}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="pb-28">
      {/* Sticky tier switcher: a two-tier hierarchy — the three priorities up
          top, the "not yet" buckets (incubating + ideas) on a second row. */}
      <div
        className="sticky top-0 z-20 -mx-4 mb-4 flex flex-col gap-1 px-4 py-2 backdrop-blur-lg"
        // Derive from the app background so the band behind the glass pills
        // reads as the same color as the page (no green/teal mismatch); the
        // partial alpha only tints cards that scroll under the sticky header.
        style={{
          backgroundColor: "color-mix(in srgb, var(--background) 60%, transparent)",
        }}
      >
        <div className="glass-pill flex gap-1 rounded-full p-1">
          {TOP_TIERS.map(renderTab)}
        </div>
        <div className="glass-pill flex gap-1 rounded-full p-1">
          {BOTTOM_TIERS.map(renderTab)}
        </div>
      </div>

      {/* Card list */}
      <div className="flex flex-col gap-3">
        {/* Key by tier so switching tabs remounts a fresh AnimatePresence:
            with initial={false}, the new tier's cards appear in place instead
            of replaying their "rise from below" entrance. Add/delete within a
            tier still animates, since that stays the same instance. */}
        <AnimatePresence key={activeTier} mode="popLayout" initial={false}>
          {items.map((p) => (
            <MobileCard
              key={p.id}
              project={p}
              onEdit={() => setEditing(p)}
              onMove={() => setMoving(p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="mt-10 text-center text-sm text-neutral-400">
            <p>No projects here yet.</p>
            <p className="mt-1">Tap + to add one.</p>
          </div>
        )}
      </div>

      {/* Floating add button */}
      <motion.button
        onClick={() => setAdding(true)}
        whileTap={{ scale: 0.92 }}
        aria-label="Add project"
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
      <BottomSheet open={adding} onClose={() => setAdding(false)} title="New project">
        {adding && (
          <ProjectFields
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
        title="Edit project"
      >
        {editing && (
          <ProjectFields
            project={editing}
            defaultTier={editing.tier}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        )}
      </BottomSheet>

      {/* Move sheet */}
      <BottomSheet
        open={moving !== null}
        onClose={() => setMoving(null)}
        title="Move to…"
      >
        <div className="flex flex-col gap-2">
          {TIERS.map((t) => {
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
