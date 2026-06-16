"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { type MusicTier } from "@/types/db";

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
  const rating = parseRating(formData.get("rating"));

  await supabase.from("albums").insert({
    user_id: user.id,
    title,
    artist,
    genre,
    rating,
    notes,
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
