// Shared shape for a Last.fm lookup result. Kept in its own module (no
// "server-only" guard) so both the server-side client and client components can
// import the type without dragging server code into the browser bundle.
export type LastfmAlbum = {
  title: string;
  artist: string;
  // Best available cover-art URL, or null when Last.fm only has a placeholder.
  image: string | null;
  // Top tag, used as a genre suggestion. Only present on enriched lookups.
  genre?: string | null;
  // Listen count, only present on a user's top-albums import.
  playcount?: number;
};
