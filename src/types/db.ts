export type ProjectTier =
  | "primary"
  | "secondary"
  | "tertiary"
  | "incubating"
  | "idea"
  | "completed";
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
  // Free-form notes for this sub-goal, edited inline on the hero cards.
  notes: string | null;
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
  // A short tagline shown under the title on the big "hero" tier cards.
  subtitle: string | null;
  description: string | null;
  tier: ProjectTier;
  status: ProjectStatus;
  due_date: string | null;
  // When a project is moved into the Completed column, we remember which tier it
  // came from so the crown orb can be tinted by its origin and it can be
  // restored later. Null for projects that have never been completed.
  completed_from_tier: ProjectTier | null;
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
  { value: "completed", label: "Completed" },
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

// ---------------------------------------------------------------------------
// Gaming
// ---------------------------------------------------------------------------
// The gaming dashboard borrows the projects' tab/tier structure, but with four
// purpose-built tiers and no separate status field — the tier *is* the status.
export type GameTier = "playing" | "backlog" | "archived" | "completed";

export type Game = {
  id: string;
  user_id: string;
  title: string;
  // A short tagline shown under the title on the cards.
  subtitle: string | null;
  description: string | null;
  // Optional platform tag (PC, PS5, Switch, …) shown as a chip on the card.
  platform: string | null;
  tier: GameTier;
  created_at: string;
  updated_at: string;
};

export const GAME_TIERS: { value: GameTier; label: string }[] = [
  { value: "playing", label: "Playing" },
  { value: "backlog", label: "Backlog" },
  { value: "archived", label: "Archived" },
  { value: "completed", label: "Completed" },
];

// ---------------------------------------------------------------------------
// Music
// ---------------------------------------------------------------------------
// A simple two-tier shelf for the albums and artists Luca enjoys: things he's
// already "Listened" to (with a rating) and a "Backlog" of what's queued up.
export type MusicTier = "listened" | "backlog";

export type Album = {
  id: string;
  user_id: string;
  // The album or artist being logged.
  title: string;
  // Who made it — shown as the subtitle line on the card.
  artist: string | null;
  // A free-text genre tag (Jazz, Hip-Hop, …) shown as a chip on the card.
  genre: string | null;
  // A personal score out of 10. Null until rated (e.g. while in the backlog).
  rating: number | null;
  // Misc notes — favourite tracks, where you heard it, why it's queued, …
  notes: string | null;
  // Cover art URL, typically populated from Last.fm. Null when unknown.
  image_url: string | null;
  // Last.fm scrobble count, set on import. Null for manually-added entries.
  playcount: number | null;
  // When this album was last listened to (from Last.fm recent tracks), used for
  // the "recently listened" sort. Null when unknown — falls back to created_at.
  last_played_at: string | null;
  tier: MusicTier;
  created_at: string;
  updated_at: string;
};

// Sort orders for the music shelf. "added" is the default (newest logged first).
export type MusicSort = "added" | "listened" | "scrobbles" | "rating";

export const MUSIC_SORTS: { value: MusicSort; label: string }[] = [
  { value: "added", label: "Added" },
  { value: "listened", label: "Listened" },
  { value: "scrobbles", label: "Scrobbles" },
  { value: "rating", label: "Rating" },
];

// Order a list of albums by the chosen key. Scrobbles and rating sort high→low
// with unknowns last; "listened" uses the last-played time, falling back to when
// the entry was added. Ties (and the default) fall back to most-recently-added.
export function sortAlbums(items: Album[], sort: MusicSort): Album[] {
  const added = (a: Album) => new Date(a.created_at).getTime();
  const byAdded = (a: Album, b: Album) => added(b) - added(a);
  const arr = [...items];
  switch (sort) {
    case "scrobbles":
      return arr.sort(
        (a, b) => (b.playcount ?? -1) - (a.playcount ?? -1) || byAdded(a, b),
      );
    case "rating":
      return arr.sort(
        (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byAdded(a, b),
      );
    case "listened": {
      const played = (a: Album) =>
        new Date(a.last_played_at ?? a.created_at).getTime();
      return arr.sort((a, b) => played(b) - played(a));
    }
    case "added":
    default:
      return arr.sort(byAdded);
  }
}

export const MUSIC_TIERS: { value: MusicTier; label: string }[] = [
  { value: "listened", label: "Listened" },
  { value: "backlog", label: "Backlog" },
];

// The status a project should carry for a given (possibly new) tier: Idea Vault
// items are always "Idea", an item leaving the vault becomes Active, and any
// other move leaves the existing status untouched.
export function statusForTier(
  tier: ProjectTier,
  current: ProjectStatus,
): ProjectStatus {
  if (tier === "idea") return "idea";
  // Reaching the Completed column means the work is done, full stop.
  if (tier === "completed") return "done";
  if (current === "idea") return "active";
  return current;
}
