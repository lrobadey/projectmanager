"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { type GameTier } from "@/types/db";

async function getSupabase() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

export async function createGame(formData: FormData) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const tier = (formData.get("tier") as GameTier) || "backlog";
  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const platform = String(formData.get("platform") ?? "").trim() || null;

  await supabase.from("games").insert({
    user_id: user.id,
    title,
    subtitle,
    description,
    platform,
    tier,
  });

  // The gaming board is hosted on the /projects route (the dashboard shell
  // swaps spaces client-side), so that's the path to revalidate.
  revalidatePath("/projects");
}

export async function updateGame(formData: FormData) {
  const supabase = await getSupabase();
  const id = String(formData.get("id"));

  const patch: Record<string, unknown> = {};
  if (formData.has("title")) patch.title = String(formData.get("title")).trim();
  if (formData.has("subtitle"))
    patch.subtitle = String(formData.get("subtitle")).trim() || null;
  if (formData.has("description"))
    patch.description = String(formData.get("description")).trim() || null;
  if (formData.has("platform"))
    patch.platform = String(formData.get("platform")).trim() || null;
  if (formData.has("tier")) patch.tier = formData.get("tier") as GameTier;

  await supabase.from("games").update(patch).eq("id", id);
  revalidatePath("/projects");
}

export async function moveGame(id: string, tier: GameTier) {
  const supabase = await getSupabase();
  await supabase.from("games").update({ tier }).eq("id", id);
  revalidatePath("/projects");
}

export async function deleteGame(formData: FormData) {
  const supabase = await getSupabase();
  const id = String(formData.get("id"));
  await supabase.from("games").delete().eq("id", id);
  revalidatePath("/projects");
}
