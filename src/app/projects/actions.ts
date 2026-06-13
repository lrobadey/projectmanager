"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { ProjectStatus, ProjectTier } from "@/types/db";

async function getSupabase() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

export async function createProject(formData: FormData) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const tier = (formData.get("tier") as ProjectTier) || "idea";
  const description = String(formData.get("description") ?? "").trim() || null;
  const due_date = String(formData.get("due_date") ?? "") || null;

  await supabase.from("projects").insert({
    user_id: user.id,
    title,
    description,
    tier,
    due_date,
  });

  revalidatePath("/projects");
}

export async function updateProject(formData: FormData) {
  const supabase = await getSupabase();
  const id = String(formData.get("id"));

  const patch: Record<string, unknown> = {};
  if (formData.has("title")) patch.title = String(formData.get("title")).trim();
  if (formData.has("tier")) patch.tier = formData.get("tier") as ProjectTier;
  if (formData.has("status"))
    patch.status = formData.get("status") as ProjectStatus;
  if (formData.has("description"))
    patch.description = String(formData.get("description")).trim() || null;
  if (formData.has("due_date"))
    patch.due_date = String(formData.get("due_date")) || null;

  await supabase.from("projects").update(patch).eq("id", id);
  revalidatePath("/projects");
}

export async function moveProject(id: string, tier: ProjectTier) {
  const supabase = await getSupabase();
  await supabase.from("projects").update({ tier }).eq("id", id);
  revalidatePath("/projects");
}

export async function deleteProject(formData: FormData) {
  const supabase = await getSupabase();
  const id = String(formData.get("id"));
  await supabase.from("projects").delete().eq("id", id);
  revalidatePath("/projects");
}

// ---------------------------------------------------------------------------
// Sub-goals
// ---------------------------------------------------------------------------

export async function addSubgoal(formData: FormData) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const project_id = String(formData.get("project_id"));
  const title = String(formData.get("title") ?? "").trim();
  if (!project_id || !title) return;

  // New sub-goals append to the bottom of the list.
  const { count } = await supabase
    .from("subgoals")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project_id);

  await supabase.from("subgoals").insert({
    user_id: user.id,
    project_id,
    title,
    position: count ?? 0,
  });

  revalidatePath("/projects");
}

export async function toggleSubgoal(id: string, completed: boolean) {
  const supabase = await getSupabase();
  await supabase.from("subgoals").update({ completed }).eq("id", id);
  revalidatePath("/projects");
}

export async function deleteSubgoal(id: string) {
  const supabase = await getSupabase();
  await supabase.from("subgoals").delete().eq("id", id);
  revalidatePath("/projects");
}
