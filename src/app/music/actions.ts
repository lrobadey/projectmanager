"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { type MusicTier } from "@/types/db";
import {
  albumDetails,
  lastfmEnabled,
  recentAlbumPlays,
  searchAlbums as lastfmSearchAlbums,
  topAlbums,
} from "./lastfm";
import { type LastfmAlbum } from "./types";

async function getSupabase() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

// Parse a rating field into a clamped 0–10 integer, or null when left blank.
function parseRating(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Math.round(Number(raw));
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(10, n));
}

export async function createAlbum(formData: FormData) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const tier = (formData.get("tier") as MusicTier) || "backlog";
  const artist = String(formData.get("artist") ?? "").trim() || null;
  const genre = String(formData.get("genre") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const image_url = String(formData.get("image_url") ?? "").trim() || null;
  const rating = parseRating(formData.get("rating"));

  await supabase.from("albums").insert({
    user_id: user.id,
    title,
    artist,
    genre,
    rating,
    notes,
    image_url,
    tier,
  });

  // The music board is hosted on the /projects route (the dashboard shell swaps
  // spaces client-side), so that's the path to revalidate.
  revalidatePath("/projects");
}

export async function updateAlbum(formData: FormData) {
  const supabase = await getSupabase();
  const id = String(formData.get("id"));

  const patch: Record<string, unknown> = {};
  if (formData.has("title")) patch.title = String(formData.get("title")).trim();
  if (formData.has("artist"))
    patch.artist = String(formData.get("artist")).trim() || null;
  if (formData.has("genre"))
    patch.genre = String(formData.get("genre")).trim() || null;
  if (formData.has("notes"))
    patch.notes = String(formData.get("notes")).trim() || null;
  if (formData.has("image_url"))
    patch.image_url = String(formData.get("image_url")).trim() || null;
  if (formData.has("rating")) patch.rating = parseRating(formData.get("rating"));
  if (formData.has("tier")) patch.tier = formData.get("tier") as MusicTier;

  await supabase.from("albums").update(patch).eq("id", id);
  revalidatePath("/projects");
}

export async function moveAlbum(id: string, tier: MusicTier) {
  const supabase = await getSupabase();
  await supabase.from("albums").update({ tier }).eq("id", id);
  revalidatePath("/projects");
}

export async function deleteAlbum(formData: FormData) {
  const supabase = await getSupabase();
  const id = String(formData.get("id"));
  await supabase.from("albums").delete().eq("id", id);
  revalidatePath("/projects");
}

// ---------------------------------------------------------------------------
// Last.fm integration (read-only, public data — API key only, no user OAuth)
// ---------------------------------------------------------------------------

// Require a signed-in user before spending our shared API quota on a lookup.
async function requireUser() {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Typeahead used by the add form. Returns [] when unauthenticated or unconfigured
// so the search box silently degrades to a plain text input.
export async function searchAlbums(query: string): Promise<LastfmAlbum[]> {
  if (!(await requireUser())) return [];
  return lastfmSearchAlbums(query);
}

// Enrich a picked album with a genre suggestion + best artwork.
export async function lookupAlbumDetails(
  artist: string,
  album: string,
): Promise<{ genre: string | null; image: string | null } | null> {
  if (!(await requireUser())) return null;
  return albumDetails(artist, album);
}

export type ImportResult = {
  imported: number;
  skipped: number;
  error?: string;
};

// Pull a user's most-played albums and drop the new ones onto the Listened
// shelf (unrated — Last.fm has no ratings, you score them yourself). Albums you
// already have (matched on title + artist) are skipped so re-running is safe.
export async function importTopAlbums(
  username: string,
  count = 24,
): Promise<ImportResult> {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!lastfmEnabled())
    return { imported: 0, skipped: 0, error: "Last.fm is not configured on the server." };

  const uname = username.trim();
  if (!uname) return { imported: 0, skipped: 0, error: "Enter a Last.fm username." };

  const limit = Math.min(50, Math.max(1, count));
  const albums = await topAlbums(uname, limit);
  if (albums.length === 0)
    return {
      imported: 0,
      skipped: 0,
      error: `No public top albums found for "${uname}".`,
    };

  const supabase = await getSupabase();

  // Best-effort "last listened" dates from recent scrobbles (recent window only).
  const recent = await recentAlbumPlays(uname);
  const lastPlayed = (title: string, artist: string): string | null => {
    const ms = recent.get(`${title}␟${artist}`.toLowerCase());
    return ms ? new Date(ms).toISOString() : null;
  };

  // Skip anything already on the shelf (case-insensitive title + artist match).
  const { data: existing } = await supabase
    .from("albums")
    .select("title, artist")
    .eq("user_id", user.id);
  const key = (title: string, artist: string) =>
    `${title} ${artist}`.toLowerCase();
  const seen = new Set(
    (existing ?? []).map((e) => key(e.title ?? "", e.artist ?? "")),
  );

  const rows = albums
    .filter((a) => !seen.has(key(a.title, a.artist)))
    .map((a) => ({
      user_id: user.id,
      title: a.title,
      artist: a.artist,
      genre: null as string | null,
      rating: null as number | null,
      notes: null as string | null,
      image_url: a.image,
      playcount: a.playcount ?? null,
      last_played_at: lastPlayed(a.title, a.artist),
      tier: "listened" as MusicTier,
    }));

  if (rows.length > 0) await supabase.from("albums").insert(rows);

  revalidatePath("/projects");
  return { imported: rows.length, skipped: albums.length - rows.length };
}
