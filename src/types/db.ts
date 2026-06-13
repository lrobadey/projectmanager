export type ProjectTier = "primary" | "secondary" | "tertiary" | "idea";
export type ProjectStatus = "active" | "on_hold" | "done" | "archived";

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
  { value: "idea", label: "Idea Vault" },
];

export const STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "done", label: "Done" },
  { value: "archived", label: "Archived" },
];
