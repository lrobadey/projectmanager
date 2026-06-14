"use client";

import { motion } from "motion/react";
import { STATUS_LABELS, type Project, type ProjectLink } from "@/types/db";
import HeroSubgoalList from "./HeroSubgoalList";
import LinkList from "./LinkList";

const statusColor: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  on_hold:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  archived:
    "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  idea: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

/**
 * The big "hero" card used for the current primary / secondary / tertiary
 * project on mobile. Compared to the regular card it gives a project room to
 * breathe: a large title, a subtitle, a roomy notes block, and sub-goals
 * expanded into their own nested glass tiles.
 */
export default function MobileHeroCard({
  project,
  onEdit,
  onMove,
  onDelete,
  onAddLink,
  onDeleteLink,
}: {
  project: Project;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
  onAddLink: (link: ProjectLink) => void;
  onDeleteLink: (id: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 34 }}
      className="glass flex flex-col gap-4 rounded-[28px] p-5"
    >
      {/* Title block + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold leading-tight tracking-tight text-neutral-50">
            {project.title}
          </h2>
          {project.subtitle && (
            <p className="mt-1 text-sm font-medium italic text-neutral-300">
              {project.subtitle}
            </p>
          )}
        </div>
        <span
          className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusColor[project.status]}`}
        >
          {STATUS_LABELS[project.status]}
        </span>
      </div>

      {/* Main notes / text section */}
      {project.description && (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-200">
          {project.description}
        </p>
      )}

      {project.due_date && (
        <p className="text-xs font-medium text-neutral-400">
          Due {project.due_date}
        </p>
      )}

      {/* Expanded sub-goals as nested glass tiles */}
      <div className="border-t border-white/10 pt-4">
        <HeroSubgoalList
          projectId={project.id}
          subgoals={project.subgoals ?? []}
        />
      </div>

      <LinkList
        projectId={project.id}
        links={project.links ?? []}
        onAdd={onAddLink}
        onDelete={onDeleteLink}
      />

      {/* Card actions */}
      <div className="flex gap-1 border-t border-white/10 pt-3 text-sm font-medium text-neutral-300">
        <button
          onClick={onEdit}
          className="rounded-lg px-3 py-1.5 active:bg-white/10"
        >
          Edit
        </button>
        <button
          onClick={onMove}
          className="rounded-lg px-3 py-1.5 active:bg-white/10"
        >
          Move
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg px-3 py-1.5 text-red-400 active:bg-red-950/40"
        >
          Delete
        </button>
      </div>
    </motion.div>
  );
}
