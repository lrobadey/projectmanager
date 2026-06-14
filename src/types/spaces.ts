// Dashboard "spaces" — the app is more than a project manager: the glass pill in
// the header swaps between several life dashboards, each with (eventually) its own
// structure and tables. "Projects" is the original, fully-live space; the others
// are placeholders we flesh out one at a time.

export type SpaceId =
  | "projects"
  | "gaming"
  | "reading"
  | "music"
  | "application";

export type Space = {
  id: SpaceId;
  // The word that sits inside the pill, reading as "Luca's <word> Dashboard".
  word: string;
  // A small emoji used in the dropdown and on the placeholder.
  icon: string;
  // One-line description of what this dashboard is (or will be) for.
  tagline: string;
  // Live spaces render a real dashboard; the rest show a "coming soon" card.
  live: boolean;
};

export const SPACES: Space[] = [
  {
    id: "projects",
    word: "Project",
    icon: "🗂️",
    tagline: "Goals, tiers, and ideas across everything you're building.",
    live: true,
  },
  {
    id: "gaming",
    word: "Gaming",
    icon: "🎮",
    tagline: "A backlog with platforms, hours played, and platinums.",
    live: false,
  },
  {
    id: "reading",
    word: "Reading",
    icon: "📚",
    tagline: "Books to read, in progress, and finished — with notes and ratings.",
    live: false,
  },
  {
    id: "music",
    word: "Music",
    icon: "🎵",
    tagline: "Pieces, playlists, and a practice log for the work you make.",
    live: false,
  },
  {
    id: "application",
    word: "Application",
    icon: "📨",
    tagline: "Music opportunities and jobs — submissions, deadlines, and status.",
    live: false,
  },
];

export const SPACE_BY_ID: Record<SpaceId, Space> = Object.fromEntries(
  SPACES.map((s) => [s.id, s]),
) as Record<SpaceId, Space>;

// Coerce an arbitrary string (from a URL param or localStorage) into a known
// space id, falling back to the always-present Projects dashboard.
export function resolveSpace(value: string | null | undefined): SpaceId {
  if (value && value in SPACE_BY_ID) return value as SpaceId;
  return "projects";
}
