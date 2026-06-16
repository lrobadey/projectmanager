import "server-only";
import { type LastfmAlbum } from "./types";

// A thin server-only wrapper over the Last.fm 2.0 web API. Everything here uses
// only public, read-only methods, so a single API key (no user OAuth/session) is
// enough. The key lives in LASTFM_API_KEY and never reaches the browser.
const BASE = "https://ws.audioscrobbler.com/2.0/";

// Last.fm hands back this grey star image when it has no real artwork; treat it
// as "no image" so cards fall back to our own placeholder.
const PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

export function lastfmEnabled(): boolean {
  return Boolean(process.env.LASTFM_API_KEY);
}

type LastfmImage = { "#text": string; size: string };

// Pick the largest real cover image from Last.fm's small→extralarge array.
function pickImage(images?: LastfmImage[]): string | null {
  if (!Array.isArray(images)) return null;
  const order = ["extralarge", "large", "medium", "small"];
  const bySize = (size: string) =>
    images.find((i) => i.size === size && i["#text"] && !i["#text"].includes(PLACEHOLDER_HASH));
  for (const size of order) {
    const hit = bySize(size);
    if (hit) return hit["#text"];
  }
  return null;
}

// Last.fm tags come back lowercased ("hip-hop"); present them a little nicer.
function titleCase(tag: string): string {
  return tag.replace(/\b\w/g, (c) => c.toUpperCase());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(params: Record<string, string>, revalidate: number): Promise<any | null> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return null;
  const usp = new URLSearchParams({ ...params, api_key: key, format: "json" });
  try {
    const res = await fetch(`${BASE}?${usp.toString()}`, { next: { revalidate } });
    if (!res.ok) return null;
    const data = await res.json();
    // Last.fm signals problems with a numeric `error` field rather than HTTP.
    if (data?.error) return null;
    return data;
  } catch {
    return null;
  }
}

// Typeahead search over album names. Cached for an hour — results barely move.
export async function searchAlbums(query: string, limit = 8): Promise<LastfmAlbum[]> {
  const q = query.trim();
  if (!q) return [];
  const data = await call(
    { method: "album.search", album: q, limit: String(limit) },
    3600,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches: any[] = data?.results?.albummatches?.album ?? [];
  return matches
    .map((a) => ({
      title: String(a.name ?? ""),
      artist: String(a.artist ?? ""),
      image: pickImage(a.image),
    }))
    .filter((a) => a.title && a.artist);
}

// Enrich a chosen album with a genre (top tag) and the best artwork. Cached for
// a day — album metadata is effectively static.
export async function albumDetails(
  artist: string,
  album: string,
): Promise<{ genre: string | null; image: string | null } | null> {
  if (!artist.trim() || !album.trim()) return null;
  const data = await call(
    { method: "album.getinfo", artist, album, autocorrect: "1" },
    86400,
  );
  const info = data?.album;
  if (!info) return null;
  const tag = info.tags?.tag;
  const first = Array.isArray(tag) ? tag[0]?.name : tag?.name;
  return {
    genre: first ? titleCase(String(first)) : null,
    image: pickImage(info.image),
  };
}

// Build a map of "title␟artist" → most recent listen time (ms) from a user's
// recent scrobbles, so imported albums can carry a real "last listened" date.
// Only covers the recent window Last.fm returns, so older albums may be absent.
export async function recentAlbumPlays(
  username: string,
  pages = 1,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const u = username.trim();
  if (!u) return out;
  for (let page = 1; page <= pages; page++) {
    const data = await call(
      {
        method: "user.getrecenttracks",
        user: u,
        limit: "200",
        page: String(page),
      },
      600,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks: any[] = data?.recenttracks?.track ?? [];
    if (tracks.length === 0) break;
    for (const t of tracks) {
      const uts = Number(t?.date?.uts);
      if (!uts) continue; // skip the "now playing" track (no timestamp)
      const album = String(t.album?.["#text"] ?? "");
      const artist = String(t.artist?.["#text"] ?? t.artist?.name ?? "");
      if (!album || !artist) continue;
      const k = `${album}␟${artist}`.toLowerCase();
      const ms = uts * 1000;
      if (ms > (out.get(k) ?? 0)) out.set(k, ms);
    }
  }
  return out;
}

// A user's most-played albums, used to seed the Listened shelf on import.
export async function topAlbums(username: string, limit = 20): Promise<LastfmAlbum[]> {
  const u = username.trim();
  if (!u) return [];
  const data = await call(
    { method: "user.gettopalbums", user: u, period: "overall", limit: String(limit) },
    600,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const albums: any[] = data?.topalbums?.album ?? [];
  return albums
    .map((a) => ({
      title: String(a.name ?? ""),
      artist: String(a.artist?.name ?? a.artist ?? ""),
      image: pickImage(a.image),
      playcount: Number(a.playcount) || 0,
    }))
    .filter((a) => a.title && a.artist);
}
