export type ProjectTier =
  | "primary"
  | "secondary"
  | "tertiary"
  | "incubating"
  | "idea";
export type ProjectStatus =
  | "active"
  | "on_hold"
  | "done"
  | "archived"
  | "idea";

export type Subgoal = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
};

export type ProjectLink = {
  id: string;
  project_id: string;
  user_id: string;
  url: string;
  title: string | null;
  position: number;
  created_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  tier: ProjectTier;
  status: ProjectStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined in via the projects query; may be absent on partial fetches.
  subgoals?: Subgoal[];
  links?: ProjectLink[];
};

export type Milestone = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  created_at: string;
};

export const TIERS: { value: ProjectTier; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "tertiary", label: "Tertiary" },
  { value: "incubating", label: "Incubating" },
  { value: "idea", label: "Idea Vault" },
];

// Selectable work statuses. "idea" is intentionally absent — it belongs to the
// Idea Vault tier and is applied automatically, never chosen from a dropdown.
export const STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "done", label: "Done" },
  { value: "archived", label: "Archived" },
];

// Display labels for every status, including the tier-driven "Idea".
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On Hold",
  done: "Done",
  archived: "Archived",
  idea: "Idea",
};

// The status a project should carry for a given (possibly new) tier: Idea Vault
// items are always "Idea", an item leaving the vault becomes Active, and any
// other move leaves the existing status untouched.
export function statusForTier(
  tier: ProjectTier,
  current: ProjectStatus,
): ProjectStatus {
  if (tier === "idea") return "idea";
  if (current === "idea") return "active";
  return current;
}
