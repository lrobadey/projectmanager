"use client";

import { useState } from "react";
import { deleteProject, updateProject } from "./actions";
import { STATUSES, TIERS, type Project } from "@/types/db";

const statusColor: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  on_hold:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  done: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  archived:
    "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

export default function ProjectCard({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={async (fd) => {
          await updateProject(fd);
          setEditing(false);
        }}
        className="flex flex-col gap-2 rounded-lg border border-neutral-300 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <input type="hidden" name="id" value={project.id} />
        <input
          name="title"
          defaultValue={project.title}
          required
          className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        <textarea
          name="description"
          defaultValue={project.description ?? ""}
          rows={2}
          placeholder="Notes"
          className="rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        <div className="flex gap-2">
          <select
            name="tier"
            defaultValue={project.tier}
            className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={project.status}
            className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <input
          name="due_date"
          type="date"
          defaultValue={project.due_date ?? ""}
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
    );
  }

  return (
    <div className="group flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug">{project.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[project.status]}`}
        >
          {STATUSES.find((s) => s.value === project.status)?.label}
        </span>
      </div>
      {project.description && (
        <p className="text-xs text-neutral-500">{project.description}</p>
      )}
      {project.due_date && (
        <p className="text-[11px] text-neutral-400">Due {project.due_date}</p>
      )}
      <div className="mt-1 flex gap-3 text-[11px] text-neutral-400 opacity-0 transition group-hover:opacity-100">
        <button onClick={() => setEditing(true)} className="hover:text-neutral-700">
          Edit
        </button>
        <form
          action={deleteProject}
          onSubmit={(e) => {
            if (!confirm("Delete this project?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={project.id} />
          <button type="submit" className="hover:text-red-600">
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}
